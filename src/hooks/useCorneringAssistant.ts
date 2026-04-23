import { useState, useEffect, useRef } from 'react';
import { curveService, RoadNode, CurveData } from '../services/CurveAnalysisService';
import { fetchRoutePoints } from '../services/googleMapsService';

interface UseCorneringAssistant {
  nextCurve: CurveData | null;
  posteriorCurve: CurveData | null;
  upcomingNodes: RoadNode[];
  isLoading: boolean;
  lookAheadDistance: number;
  setDestination: (dest: string | null) => void;
  destination: string | null;
  isRouteMode: boolean;
  currentRoadName: string | null;
  snappedLocation: RoadNode | null;
}

export function useCorneringAssistant(
  lat: number | null,
  lng: number | null,
  heading: number | null,
  speedKmh: number,
  userId?: string,
  isGuest = false,
  config?: {
    baseDist?: number;
    speedFactor?: number;
    maxDist?: number;
  },
  externalDestination?: string | null
) {
  const [curves, setCurves] = useState<CurveData[]>([]);
  const [upcomingNodes, setUpcomingNodes] = useState<RoadNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [destination, setDestination] = useState<string | null>(externalDestination || null);
  const [isRouteMode, setIsRouteMode] = useState(false);
  const [currentRoadName, setCurrentRoadName] = useState<string | null>(null);
  const [snappedLocation, setSnappedLocation] = useState<RoadNode | null>(null);
  const [smoothLocation, setSmoothLocation] = useState<{lat: number, lng: number, heading: number} | null>(null);
  
  const lastFetchRef = useRef<{ lat: number, lng: number } | null>(null);
  const extrapolationRef = useRef<{
    lastLat: number;
    lastLng: number;
    lastHeading: number;
    lastSpeed: number;
    lastTime: number;
  } | null>(null);

  // Sync with external destination if provided
  useEffect(() => {
    if (externalDestination !== undefined) {
      setDestination(externalDestination);
    }
  }, [externalDestination]);

  // Default values for look-ahead
  const baseDist = config?.baseDist ?? 2000; 
  const speedFactor = config?.speedFactor ?? 12; 
  const maxDist = config?.maxDist ?? 4000; 

  // Dynamic distance calculation
  const lookAheadDistance = Math.min(maxDist, baseDist + (speedKmh * speedFactor));

  // 1. Fetch Geometry (Either Route-based or Scan-based)
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

    // Default Scanner: Check if we moved enough to warrant a check (30m for better resolution)
    const shouldFetch = !lastFetchRef.current || 
      curveService.haversineDistance(lat, lng, lastFetchRef.current.lat, lastFetchRef.current.lng) > 30;

    if (shouldFetch) {
      const updateGeometry = async () => {
        setIsLoading(true);
        const { nodes, roadName } = await curveService.getRoadGeometry(lat, lng, heading, speedKmh);
        if (nodes.length > 0) {
          setUpcomingNodes(nodes);
          setCurrentRoadName(roadName);
          setIsRouteMode(false);
          lastFetchRef.current = { lat, lng };
          
          // Persistence: Store the latest geometry for total offline survival
          localStorage.setItem('dragfire_active_geometry', JSON.stringify({ nodes, roadName, timestamp: Date.now() }));
        }
        setIsLoading(false);
      };
      updateGeometry();
    }
  }, [lat, lng, destination, userId, isGuest]);

  // Initial Load from Cache for 100% Offline Start
  useEffect(() => {
     try {
       const cached = localStorage.getItem('dragfire_active_geometry');
       if (cached && !upcomingNodes.length) {
          const { nodes, roadName } = JSON.parse(cached);
          setUpcomingNodes(nodes);
          setCurrentRoadName(roadName);
          console.log("Cornering Assistant: Started with cached offline geometry.");
       }
     } catch (e) {}
  }, []);

  // Extrapolation Loop (Dead Reckoning)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!extrapolationRef.current || speedKmh < 5) return;

      const now = Date.now();
      const dt = (now - extrapolationRef.current.lastTime) / 1000;
      
      // Only extrapolate for up to 2 seconds of silence
      if (dt > 0.05 && dt < 2.0) {
        const speedMs = (speedKmh / 3.6);
        const distance = speedMs * dt;
        
        const R = 6371000;
        const brng = (extrapolationRef.current.lastHeading * Math.PI) / 180;
        const lat1 = (extrapolationRef.current.lastLat * Math.PI) / 180;
        const lon1 = (extrapolationRef.current.lastLng * Math.PI) / 180;

        const lat2 = Math.asin(Math.sin(lat1) * Math.cos(distance / R) +
                     Math.cos(lat1) * Math.sin(distance / R) * Math.cos(brng));
        const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(distance / R) * Math.cos(lat1),
                     Math.cos(distance / R) - Math.sin(lat1) * Math.sin(lat2));

        setSmoothLocation({
          lat: (lat2 * 180) / Math.PI,
          lng: (lon2 * 180) / Math.PI,
          heading: extrapolationRef.current.lastHeading
        });
      }
    }, 50);

    return () => clearInterval(interval);
  }, [speedKmh]);

  // Sync Extrapolation with real GPS
  useEffect(() => {
    if (lat !== null && lng !== null) {
      extrapolationRef.current = {
        lastLat: lat,
        lastLng: lng,
        lastHeading: heading || extrapolationRef.current?.lastHeading || 0,
        lastSpeed: speedKmh,
        lastTime: Date.now()
      };
      setSmoothLocation({ lat, lng, heading: heading || 0 });
    }
  }, [lat, lng, heading, speedKmh]);

  // 2. Perform Curve Analysis
  useEffect(() => {
    if (!upcomingNodes.length || lat === null || lng === null) {
      setCurves([]);
      return;
    }

    // Analyze upcoming curves based on current position and heading
    const foundCurves = curveService.findUpcomingCurves(lat, lng, heading, upcomingNodes, lookAheadDistance, speedKmh);
    setCurves(foundCurves);

    // Update Snapped Location for Minimap stability
    const snapped = curveService.snapToRoad(lat, lng);
    setSnappedLocation(snapped);

  }, [lat, lng, heading, upcomingNodes, lookAheadDistance]);

  return { 
    nextCurve: curves[0] || null, 
    posteriorCurve: curves[1] || null,
    upcomingNodes, 
    isLoading, 
    lookAheadDistance, 
    setDestination, 
    destination,
    isRouteMode,
    currentRoadName,
    snappedLocation,
    smoothLocation
  };
}
