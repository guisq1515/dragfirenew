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
  
  // Refs for smooth prediction
  const preCalculatedRef = useRef<CurveData[]>([]);
  const lastFetchRef = useRef<{ lat: number, lng: number, heading: number } | null>(null);
  const lastSyncTimeRef = useRef<number>(Date.now());
  const lastSyncDistancesRef = useRef<Record<string, number>>({});
  const speedRef = useRef<number>(speedKmh);
  const imuRef = useRef<IMUData | null>(null);

  const watchdogRef = useRef({
    lastDistance: -1,
    lastChangeTime: Date.now(),
    frozenCount: 0
  });

  const extrapolationRef = useRef<{
    lastLat: number;
    lastLng: number;
    lastHeading: number;
    lastTime: number;
  } | null>(null);
  const distanceSinceLastPreloadRef = useRef<number>(0);
  const lastLatRef = useRef<number | null>(null);
  const lastLngRef = useRef<number | null>(null);

  // Keep speed and imu updated via refs for high-frequency access
  useEffect(() => { speedRef.current = speedKmh; }, [speedKmh]);
  
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
    const unsub = sensorFusion.addListener(data => {
      setImu(data);
      imuRef.current = data;
    });
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
          // Idea 2: Pre-download the whole route path
          offlineMapService.preloadRoute(points.map(p => ({ lat: p.lat, lng: p.lng })));
        }
        setIsLoading(false);
      };
      loadRoute();
      return;
    }

    const distToLast = lastFetchRef.current ? curveService.haversineDistance(lat, lng, lastFetchRef.current.lat, lastFetchRef.current.lng) : Infinity;
    let headingDiff = Infinity;
    if (lastFetchRef.current && heading !== null) {
      headingDiff = Math.abs(heading - lastFetchRef.current.heading);
      if (headingDiff > 180) headingDiff = 360 - headingDiff;
    }
    
    if (upcomingNodes.length === 0 || distToLast > 30 || headingDiff > 30) {
      const updateGeometry = async () => {
        if (upcomingNodes.length === 0) setIsLoading(true);
        const { nodes, roadName, allWays, preCalculatedCurves } = await curveService.getRoadGeometry(lat, lng, heading, speedRef.current);
        
        if (nodes.length > 0) {
          setUpcomingNodes(nodes);
          setAllRegionalWays(allWays);
          setCurrentRoadName(roadName);
          setIsRouteMode(false);
          preCalculatedRef.current = preCalculatedCurves || [];
          
          if (heading !== null) {
            offlineMapService.smartPreload(lat, lng, heading, speedRef.current);
          }
        } else {
          setUpcomingNodes([]);
          setCurrentRoadName(null);
          setCurves([]);
          preCalculatedRef.current = [];
        }
        
        // ALWAYS update lastFetchRef to prevent infinite loop of network requests
        // when offline and no nodes are found.
        lastFetchRef.current = { lat, lng, heading: heading || 0 };
        setIsLoading(false);
      };
      updateGeometry();
    }
  }, [lat, lng, heading, destination]);

  // High-Frequency Extrapolation (Dead Reckoning)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const dt = (now - lastSyncTimeRef.current) / 1000;
      if (dt <= 0) return;

      // Calculate travel distance since last GPS sync
      // Use acceleration if available for better prediction
      const accelLong = imuRef.current?.longitudinalG || 0;
      const currentSpeedMs = (speedRef.current / 3.6);
      const predictedSpeedMs = currentSpeedMs + (accelLong * 9.8 * dt); // v = v0 + at
      const travelDist = predictedSpeedMs * dt;

      // Update curves distance smoothly
      setCurves(prev => prev.map(c => {
        const syncDist = lastSyncDistancesRef.current[c.id!] ?? c.distance;
        const newDist = Math.max(0, Math.round(syncDist - travelDist));
        
        // Prevent distance from "jumping up" during extrapolation
        if (newDist > c.distance + 2) return c; 
        return { ...c, distance: newDist };
      }).filter(c => c.distance > 5)); // Tight removal filter

      // Also extrapolate GPS position for minimap smoothness
      if (extrapolationRef.current && speedRef.current > 5) {
        const GPS_dt = (now - extrapolationRef.current.lastTime) / 1000;
        if (GPS_dt < 2.0) {
          const dist = predictedSpeedMs * GPS_dt;
          const R = 6371000;
          const brng = (extrapolationRef.current.lastHeading * Math.PI) / 180;
          const lat1 = (extrapolationRef.current.lastLat * Math.PI) / 180;
          const lon1 = (extrapolationRef.current.lastLng * Math.PI) / 180;
          const lat2 = Math.asin(Math.sin(lat1) * Math.cos(dist / R) + Math.cos(lat1) * Math.sin(dist / R) * Math.cos(brng));
          const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(dist / R) * Math.cos(lat1), Math.cos(dist / R) - Math.sin(lat1) * Math.sin(lat2));
          setSmoothLocation({ lat: (lat2 * 180) / Math.PI, lng: (lon2 * 180) / Math.PI, heading: extrapolationRef.current.lastHeading });
        }
      }
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // GPS Sync Trigger
  useEffect(() => {
    if (lat !== null && lng !== null) {
      extrapolationRef.current = { lastLat: lat, lastLng: lng, lastHeading: heading || extrapolationRef.current?.lastHeading || 0, lastTime: Date.now() };
      setSmoothLocation({ lat, lng, heading: heading || 0 });
      
      // Perform path-based distance calculation (Heavy sync)
      if (upcomingNodes.length > 0) {
        let foundCurves: CurveData[] = [];
        let closest = 0, minDist = Infinity;
        
        upcomingNodes.forEach((n, idx) => {
          const d = curveService.haversineDistance(lat, lng, n.lat, n.lng);
          if (d < minDist) { minDist = d; closest = idx; }
        });

        if (preCalculatedRef.current.length > 0) {
          foundCurves = preCalculatedRef.current
            .map((c, index) => {
              let pDist = 0;
              let foundStart = false;
              let foundEnd = false;
              
              // Use a small tolerance for coordinate matching
              const TOLERANCE = 0.0005; 
              
              for (let i = closest; i < Math.min(closest + 500, upcomingNodes.length - 1); i++) {
                const n1 = upcomingNodes[i], n2 = upcomingNodes[i+1];
                
                if (!foundStart) {
                  if (Math.abs(n2.lat - c.points[0].lat) < TOLERANCE && Math.abs(n2.lng - c.points[0].lng) < TOLERANCE) {
                    foundStart = true;
                  } else {
                    pDist += curveService.haversineDistance(n1.lat, n1.lng, n2.lat, n2.lng);
                  }
                }
                
                if (Math.abs(n2.lat - c.points[c.points.length-1].lat) < TOLERANCE && Math.abs(n2.lng - c.points[c.points.length-1].lng) < TOLERANCE) {
                  foundEnd = true;
                  break;
                }
              }

              let distance = -1;
              if (foundStart) {
                // Curve is ahead of us
                distance = Math.round(pDist);
              } else if (foundEnd) {
                // Curve start is behind us, but end is ahead of us. We are INSIDE the curve.
                distance = 0; 
              } else {
                // Both start and end are behind us, or curve is completely off-path.
                distance = Math.round(curveService.haversineDistance(lat, lng, c.points[0].lat, c.points[0].lng));
              }
              
              return {
                ...c,
                id: (c as any).id || `pre_${c.severity}_${c.direction}_${c.points[0]?.lat.toFixed(4)}_${c.points[0]?.lng.toFixed(4)}_${index}`,
                distance,
                isPathAccurate: foundStart || foundEnd,
                isInside: !foundStart && foundEnd
              };
            })
            .filter(c => {
              const dist = c.distance;
              
              // Instantly pop the curve if we are inside it or very close
              if (dist <= 5 || dist > lookAheadDistance) return false;
              
              // If using haversine fallback
              if (!c.isPathAccurate) {
                // If it's close but wasn't found in the path ahead, it's already behind us.
                if (dist < 1000) return false;
                
                if (heading !== null) {
                  const bearing = curveService.calculateHeading({ lat, lng }, c.points[0]);
                  let diff = Math.abs(heading - bearing);
                  if (diff > 180) diff = 360 - diff;
                  if (diff > 90) return false; // Filter if > 90 degrees away from current heading
                }
              }
              return true;
            })
            .sort((a, b) => a.distance - b.distance);
        } else {
          foundCurves = curveService.findUpcomingCurves(lat, lng, heading, upcomingNodes, lookAheadDistance, speedRef.current)
            .map((c, index) => ({
              ...c,
              id: (c as any).id || `dyn_${c.severity}_${c.direction}_${c.points[0]?.lat.toFixed(4)}_${c.points[0]?.lng.toFixed(4)}_${index}`
            }))
            .sort((a, b) => a.distance - b.distance);
        }

        // Store sync point for extrapolation
        const syncMap: Record<string, number> = {};
        foundCurves.forEach(c => {
          if (c.id) syncMap[c.id] = c.distance;
        });
        lastSyncDistancesRef.current = syncMap;
        lastSyncTimeRef.current = Date.now();
        
        // Smoothly merge new GPS curves with current state to prevent jumping
        setCurves(prev => {
          return foundCurves.map(newC => {
            const existing = prev.find(p => p.id === newC.id);
            if (existing) {
              // Blend logic: use larger threshold (100m) and 85% extrapolation weight
              const diff = Math.abs(newC.distance - existing.distance);
              if (diff < 100) {
                // 85% current (extrapolated), 15% new (GPS sync)
                const blendedDist = Math.round(existing.distance * 0.85 + newC.distance * 0.15);
                if (newC.id) lastSyncDistancesRef.current[newC.id] = blendedDist;
                return { ...newC, distance: blendedDist };
              }
            }
            return newC;
          });
        });
        
        // Watchdog check
        if (speedRef.current > 10 && foundCurves.length > 0) {
          const currentDist = foundCurves[0].distance;
          const isIncreasing = watchdogRef.current.lastDistance !== -1 && currentDist > watchdogRef.current.lastDistance + 20;
          if (isIncreasing) {
            console.warn("Distance anomaly: resetting geometry.");
            lastFetchRef.current = null;
            setUpcomingNodes([]);
          }
          watchdogRef.current.lastDistance = currentDist;
        }
      }

      const snapped = curveService.snapToRoad(lat, lng);
      setSnappedLocation(snapped);
      if (snapped) {
        setTrailNodes(prev => {
          if (prev.length === 0) return [snapped];
          const last = prev[prev.length - 1];
          if (curveService.haversineDistance(snapped.lat, snapped.lng, last.lat, last.lng) > 15) {
            return [...prev, snapped].slice(-300);
          }
          return prev;
        });
      }

      // Track distance for smart preloading
      if (lastLatRef.current !== null && lastLngRef.current !== null) {
        const d = curveService.haversineDistance(lat, lng, lastLatRef.current, lastLngRef.current);
        distanceSinceLastPreloadRef.current += d;
        
        const triggerDist = telemetryConfig?.smartPreloadTriggerDistance || 2000;
        const projectDist = telemetryConfig?.smartPreloadProjectDistance || 15000;

        if (distanceSinceLastPreloadRef.current >= triggerDist) {
          if (heading !== null) {
            console.log(`Smart Preload Triggered: ${distanceSinceLastPreloadRef.current.toFixed(0)}m traveled.`);
            offlineMapService.smartPreload(lat, lng, heading, speedRef.current, { triggerDist, projectDist });
            distanceSinceLastPreloadRef.current = 0;
          }
        }
      }
      lastLatRef.current = lat;
      lastLngRef.current = lng;
    }
  }, [lat, lng, heading, upcomingNodes, lookAheadDistance]);

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
