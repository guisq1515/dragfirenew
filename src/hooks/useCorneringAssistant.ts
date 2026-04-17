import { useState, useEffect, useRef } from 'react';
import { curveService, RoadNode, CurveData } from '../services/CurveAnalysisService';
import { fetchRoutePoints } from '../services/googleMapsService';

interface UseCorneringAssistant {
  nextCurve: CurveData | null;
  upcomingNodes: RoadNode[];
  isLoading: boolean;
  lookAheadDistance: number;
  setDestination: (dest: string | null) => void;
  destination: string | null;
  isRouteMode: boolean;
  currentRoadName: string | null;
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
  }
) {
  const [nextCurve, setNextCurve] = useState<CurveData | null>(null);
  const [upcomingNodes, setUpcomingNodes] = useState<RoadNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [destination, setDestination] = useState<string | null>(null);
  const [isRouteMode, setIsRouteMode] = useState(false);
  const [currentRoadName, setCurrentRoadName] = useState<string | null>(null);
  
  const lastFetchRef = useRef<{ lat: number, lng: number } | null>(null);

  // Default values for look-ahead
  const baseDist = config?.baseDist ?? 500;
  const speedFactor = config?.speedFactor ?? 5;
  const maxDist = config?.maxDist ?? 1500;

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

    // Default Scanner: Check if we moved enough to warrant a new fetch (e.g., > 100m)
    const shouldFetch = !lastFetchRef.current || 
      curveService.haversineDistance(lat, lng, lastFetchRef.current.lat, lastFetchRef.current.lng) > 100;

    if (shouldFetch) {
      const updateGeometry = async () => {
        setIsLoading(true);
        const { nodes, roadName } = await curveService.fetchRoadGeometry(lat, lng, 1000); // 1km radius
        setUpcomingNodes(nodes);
        setCurrentRoadName(roadName);
        setIsRouteMode(false);
        lastFetchRef.current = { lat, lng };
        setIsLoading(false);
      };
      updateGeometry();
    }
  }, [lat, lng, destination, userId, isGuest]);

  // 2. Perform Curve Analysis
  useEffect(() => {
    if (!upcomingNodes.length || lat === null || lng === null || heading === null) {
      setNextCurve(null);
      return;
    }

    // Analyze next curve based on current position and heading
    const analysis = curveService.findNextCurve(lat, lng, heading, upcomingNodes, lookAheadDistance);
    setNextCurve(analysis);

  }, [lat, lng, heading, upcomingNodes, lookAheadDistance]);

  return { 
    nextCurve, 
    upcomingNodes, 
    isLoading, 
    lookAheadDistance, 
    setDestination, 
    destination,
    isRouteMode,
    currentRoadName
  };
}
