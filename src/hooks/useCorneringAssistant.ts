import { useState, useEffect, useRef } from 'react';
import { curveService } from '../services/CurveAnalysisService';
import { fetchRoutePoints } from '../services/googleMapsService';
import { sensorFusion, IMUData } from '../services/SensorFusionService';
import { TelemetryConfig, RoadNode, CurveData } from '../types';
import { offlineMapService } from '../services/OfflineMapService';

interface UseCorneringAssistant {
  nextCurve: CurveData | null;
  posteriorCurve: CurveData | null;
  upcomingNodes: RoadNode[];
  allRegionalWays: RoadNode[][];
  isLoading: boolean;
  lookAheadDistance: number;
  setDestination: (dest: string | null) => void;
  destination: string | null;
  isRouteMode: boolean;
  currentRoadName: string | null;
  snappedLocation: RoadNode | null;
  smoothLocation: {lat: number, lng: number, heading: number} | null;
  trailNodes: RoadNode[];
  imu: IMUData | null;
}

export function useCorneringAssistant(
  lat: number | null,
  lng: number | null,
  heading: number | null,
  speedKmh: number,
  userId?: string,
  isGuest = false,
  telemetryConfig?: TelemetryConfig,
  externalDestination?: string | null
) {
  const [curves, setCurves] = useState<CurveData[]>([]);
  const [upcomingNodes, setUpcomingNodes] = useState<RoadNode[]>([]);
  const [allRegionalWays, setAllRegionalWays] = useState<RoadNode[][]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [destination, setDestination] = useState<string | null>(externalDestination || null);
  const [isRouteMode, setIsRouteMode] = useState(false);
  const [currentRoadName, setCurrentRoadName] = useState<string | null>(null);
  const [snappedLocation, setSnappedLocation] = useState<RoadNode | null>(null);
  const [smoothLocation, setSmoothLocation] = useState<{lat: number, lng: number, heading: number} | null>(null);
  const [imu, setImu] = useState<IMUData | null>(null);
  const [trailNodes, setTrailNodes] = useState<RoadNode[]>([]);
  const preCalculatedRef = useRef<CurveData[]>([]);
  
  const lastFetchRef = useRef<{ lat: number, lng: number, heading: number } | null>(null);
  const watchdogRef = useRef({
    lastDistance: -1,
    lastChangeTime: Date.now(),
    frozenCount: 0
  });
  const extrapolationRef = useRef<{
    lastLat: number;
    lastLng: number;
    lastHeading: number;
    lastSpeed: number;
    lastTime: number;
  } | null>(null);

  // Sync Service Config
  useEffect(() => {
    if (telemetryConfig) {
      curveService.updateConfig({
        detectionThreshold: telemetryConfig.curveDetectionThreshold,
        mediumThreshold: telemetryConfig.curveMediumThreshold,
        hardThreshold: telemetryConfig.curveHardThreshold,
        cacheRadius: telemetryConfig.regionalCacheRadius
      });
      offlineMapService.updateConfig({
        calibrationRadius: telemetryConfig.calibrationRadius || 5000,
        manualDownloadRadius: telemetryConfig.manualDownloadRadius || 20
      });
    }
  }, [telemetryConfig]);

  useEffect(() => {
    sensorFusion.start();
    const unsub = sensorFusion.addListener(data => setImu(data));
    return () => {
      sensorFusion.stop();
      unsub();
    };
  }, []);

  const baseDist = telemetryConfig?.lookAheadBaseDistance ?? 1200; 
  const speedFactor = telemetryConfig?.lookAheadSpeedFactor ?? 20; 
  const maxDist = telemetryConfig?.lookAheadMaxDistance ?? 4000; 
  const lookAheadDistance = Math.min(maxDist, baseDist + (speedKmh * speedFactor));

  // Geometry Manager
  useEffect(() => {
    if (lat === null || lng === null) return;

    if (destination) {
      const loadRoute = async () => {
        setIsLoading(true);
        const { points, status, routeName } = await fetchRoutePoints({ lat, lng }, destination, userId, isGuest);
        if (status === 'OK' && points.length > 0) {
          setUpcomingNodes(points);
          setCurrentRoadName(routeName || null);
          setIsRouteMode(true);
        }
        setIsLoading(false);
      };
      loadRoute();
      return;
    }

    const distToLast = lastFetchRef.current ? curveService.haversineDistance(lat, lng, lastFetchRef.current.lat, lastFetchRef.current.lng) : Infinity;
    const headingDiff = lastFetchRef.current ? Math.abs((heading || 0) - lastFetchRef.current.heading) : Infinity;
    
    if (distToLast > 30 || headingDiff > 30) {
      const updateGeometry = async () => {
        if (upcomingNodes.length === 0) setIsLoading(true);
        const { nodes, roadName, allWays, preCalculatedCurves } = await curveService.getRoadGeometry(lat, lng, heading, speedKmh);
        
        if (nodes.length > 0) {
          setUpcomingNodes(nodes);
          setAllRegionalWays(allWays);
          setCurrentRoadName(roadName);
          setIsRouteMode(false);
          lastFetchRef.current = { lat, lng, heading: heading || 0 };
          preCalculatedRef.current = preCalculatedCurves || [];
          
          // Background: Fetch elevation for key points
          fetchElevation(nodes.slice(0, 500));

          // Intelligent Pre-loading for the path ahead
          if (heading !== null) {
            offlineMapService.smartPreload(lat, lng, heading, speedKmh);
          }
        }
        setIsLoading(false);
      };
      updateGeometry();
    }
  }, [lat, lng, heading, speedKmh, destination]);

  const fetchElevation = async (nodes: RoadNode[]) => {
    // Only fetch for a subset of points to save API quota
    const sample = nodes.filter((_, i) => i % 10 === 0);
    const locations = sample.map(n => `${n.lat},${n.lng}`).join('|');
    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key) return;

    try {
      const resp = await fetch(`https://maps.googleapis.com/maps/api/elevation/json?locations=${locations}&key=${key}`);
      const data = await resp.json();
      if (data.status === 'OK') {
        // Map back to nodes
        const elevMap: Record<string, number> = {};
        data.results.forEach((r: any) => {
           elevMap[`${r.location.lat.toFixed(5)},${r.location.lng.toFixed(5)}`] = r.elevation;
        });
        
        setUpcomingNodes(prev => prev.map(n => ({
          ...n,
          elevation: elevMap[`${n.lat.toFixed(5)},${n.lng.toFixed(5)}`] || n.elevation
        })));
      }
    } catch (e) {}
  };

  // Dead Reckoning & GPS Sync
  useEffect(() => {
    const interval = setInterval(() => {
      if (!extrapolationRef.current || speedKmh < 5) return;
      const now = Date.now();
      const dt = (now - extrapolationRef.current.lastTime) / 1000;
      if (dt > 0.05 && dt < 2.0) {
        const speedMs = (speedKmh / 3.6);
        const distance = speedMs * dt;
        const R = 6371000;
        const brng = (extrapolationRef.current.lastHeading * Math.PI) / 180;
        const lat1 = (extrapolationRef.current.lastLat * Math.PI) / 180;
        const lon1 = (extrapolationRef.current.lastLng * Math.PI) / 180;
        const lat2 = Math.asin(Math.sin(lat1) * Math.cos(distance / R) + Math.cos(lat1) * Math.sin(distance / R) * Math.cos(brng));
        const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(distance / R) * Math.cos(lat1), Math.cos(distance / R) - Math.sin(lat1) * Math.sin(lat2));
        setSmoothLocation({ lat: (lat2 * 180) / Math.PI, lng: (lon2 * 180) / Math.PI, heading: extrapolationRef.current.lastHeading });
      }
    }, 50);
    return () => clearInterval(interval);
  }, [speedKmh]);

  useEffect(() => {
    if (lat !== null && lng !== null) {
      extrapolationRef.current = { lastLat: lat, lastLng: lng, lastHeading: heading || extrapolationRef.current?.lastHeading || 0, lastSpeed: speedKmh, lastTime: Date.now() };
      setSmoothLocation({ lat, lng, heading: heading || 0 });
    }
  }, [lat, lng, heading, speedKmh]);

  // Curve Analysis
  useEffect(() => {
    const targetLat = smoothLocation?.lat || lat;
    const targetLng = smoothLocation?.lng || lng;
    
    if (!upcomingNodes.length || targetLat === null || targetLng === null) return;

    // Strategy: If we have pre-calculated curves, we just need to update their distances
    // from the current position. If not, we run the heavy analysis.
    let foundCurves: CurveData[] = [];
    
    if (preCalculatedRef.current.length > 0) {
      // Find current position in nodes
      let closest = 0, minDist = Infinity;
      upcomingNodes.forEach((n, idx) => {
        const d = curveService.haversineDistance(targetLat, targetLng, n.lat, n.lng);
        if (d < minDist) { minDist = d; closest = idx; }
      });

      foundCurves = preCalculatedRef.current
        .map(c => {
          // Calculate path distance from current closest node to the curve start
          let pDist = 0;
          let foundTarget = false;
          for (let i = closest; i < upcomingNodes.length - 1; i++) {
            const n1 = upcomingNodes[i], n2 = upcomingNodes[i+1];
            pDist += curveService.haversineDistance(n1.lat, n1.lng, n2.lat, n2.lng);
            if (n2.lat === c.points[0].lat && n2.lng === c.points[0].lng) {
              foundTarget = true;
              break;
            }
          }
          return {
            ...c,
            distance: foundTarget ? Math.round(pDist) : Math.round(curveService.haversineDistance(targetLat, targetLng, c.points[0].lat, c.points[0].lng))
          };
        })
        .filter(c => c.distance > -50 && c.distance < lookAheadDistance)
        .sort((a, b) => a.distance - b.distance);
    }
    
    if (foundCurves.length === 0) {
      foundCurves = curveService.findUpcomingCurves(targetLat, targetLng, heading, upcomingNodes, lookAheadDistance, speedKmh);
    }
    
    setCurves(foundCurves);
    const snapped = curveService.snapToRoad(targetLat, targetLng);
    setSnappedLocation(snapped);

    // Watchdog: Anti-Freeze System
    if (speedKmh > 10 && foundCurves.length > 0) {
      const currentDist = foundCurves[0].distance;
      const now = Date.now();
      
      if (currentDist === watchdogRef.current.lastDistance) {
        const timeFrozen = (now - watchdogRef.current.lastChangeTime) / 1000;
        if (timeFrozen > 7) { // 7 seconds frozen while moving > 10km/h
          console.warn('Cornering Assistant frozen detected. Forcing reset...');
          lastFetchRef.current = null; // Force geometry refresh
          curveService.clearCache();
          watchdogRef.current.lastChangeTime = now; // Reset timer to avoid infinite loop
          // Optionally clear upcoming nodes to trigger a full re-fetch
          setUpcomingNodes([]);
        }
      } else {
        watchdogRef.current.lastDistance = currentDist;
        watchdogRef.current.lastChangeTime = now;
      }
    }

    // Trail Logic: Add snapped point to trail if it's far enough from last point
    if (snapped) {
      setTrailNodes(prev => {
        if (prev.length === 0) return [snapped];
        const last = prev[prev.length - 1];
        const dist = curveService.haversineDistance(snapped.lat, snapped.lng, last.lat, last.lng);
        if (dist > 10) { // Add every 10 meters
           // Keep trail manageable (e.g., last 500 points)
           return [...prev, snapped].slice(-500);
        }
        return prev;
      });
    }
  }, [lat, lng, heading, upcomingNodes, lookAheadDistance, speedKmh, smoothLocation]);

  return { 
    nextCurve: curves[0] || null, 
    posteriorCurve: curves[1] || null,
    upcomingNodes, 
    allRegionalWays,
    isLoading, 
    lookAheadDistance, 
    setDestination, 
    destination,
    isRouteMode,
    currentRoadName,
    snappedLocation,
    smoothLocation,
    trailNodes,
    imu
  };
}
