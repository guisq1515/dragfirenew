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
  
  const lastFetchRef = useRef<{ lat: number, lng: number } | null>(null);

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
        const { nodes, roadName } = await curveService.getRoadGeometry(lat, lng);
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
    if (!upcomingNodes.length || lat === null || lng === null) {
      setCurves([]);
      return;
    }

    // Analyze upcoming curves based on current position and heading
    const foundCurves = curveService.findUpcomingCurves(lat, lng, heading, upcomingNodes, lookAheadDistance);
    setCurves(foundCurves);

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
    currentRoadName
  };
}
