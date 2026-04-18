import { CapacitorHttp } from '@capacitor/core';

export interface RoadNode {
  lat: number;
  lng: number;
}

export interface CurveData {
  angle: number;
  severity: 'soft' | 'medium' | 'hard' | 'hairpin';
  distance: number;
  direction: 'left' | 'right';
  points: RoadNode[];
}

class CurveAnalysisService {
  private cache: Map<string, { nodes: RoadNode[], roadName: string | null }> = new Map();

  /**
   * Fetches road nodes around a coordinate using Overpass API
   */
  async fetchRoadGeometry(lat: number, lng: number, radius = 500): Promise<{ nodes: RoadNode[], roadName: string | null }> {
    const cacheKey = `${lat.toFixed(3)}-${lng.toFixed(3)}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey)!;

    try {
      // Overpass QL to get highway ways around coordinates
      const query = `
        [out:json][timeout:25];
        (
          way["highway"](around:${radius},${lat},${lng});
        );
        out body;
        >;
        out skel qt;
      `;

      const response = await CapacitorHttp.post({
        url: 'https://overpass-api.de/api/interpreter',
        data: query,
        headers: { 'Content-Type': 'text/plain' }
      });

      if (response.status === 200 && response.data.elements) {
        const nodesMap: Record<number, RoadNode> = {};
        const ways: any[] = [];

        response.data.elements.forEach((el: any) => {
          if (el.type === 'node') {
            nodesMap[el.id] = { lat: el.lat, lng: el.lon };
          } else if (el.type === 'way') {
            ways.push(el);
          }
        });

        // Simple approach: pick the closest way
        // In a production app, we would use map-matching (snapping)
        if (ways.length > 0) {
          // Find the way closest to the current lat/lng
          let bestWay = ways[0];
          let minWayDist = Infinity;

          ways.forEach(w => {
            if (w.nodes) {
              // Check the distance to each node of the way to find the actually closest way
              w.nodes.forEach((id: number) => {
                const node = nodesMap[id];
                if (node) {
                  const d = this.haversineDistance(lat, lng, node.lat, node.lng);
                  if (d < minWayDist) {
                    minWayDist = d;
                    bestWay = w;
                  }
                }
              });
            }
          });

          const roadName = bestWay.tags?.name || 
                        (bestWay.tags?.highway ? `Via ${bestWay.tags.highway.charAt(0).toUpperCase() + bestWay.tags.highway.slice(1)}` : null);
          const roadNodes = bestWay.nodes.map((id: number) => nodesMap[id]).filter(Boolean);
          this.cache.set(cacheKey, { nodes: roadNodes, roadName });
          return { nodes: roadNodes, roadName };
        }
      }
      return { nodes: [], roadName: null };
    } catch (error) {
      console.error('Error fetching Overpass data:', error);
      return { nodes: [], roadName: null };
    }
  }

  /**
   * Calculates the angle change between two segments
   */
  calculateAngle(p1: RoadNode, p2: RoadNode, p3: RoadNode): number {
    const v1 = { x: p2.lng - p1.lng, y: p2.lat - p1.lat };
    const v2 = { x: p3.lng - p2.lng, y: p3.lat - p2.lat };

    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

    if (mag1 === 0 || mag2 === 0) return 0;

    const cosTheta = dot / (mag1 * mag2);
    const angle = Math.acos(Math.max(-1, Math.min(1, cosTheta))) * (180 / Math.PI);
    
    // Cross product (Standard 2D): x1*y2 - y1*x2 
    // In Lng/Lat (X/Y), Positive Cross = Counter-Clockwise (Left in Driving)
    // Negative Cross = Clockwise (Right in Driving)
    const cross = v1.x * v2.y - v1.y * v2.x;
    
    // Returning positive for RIGHT, negative for LEFT
    return cross < 0 ? angle : -angle;
  }

  /**
   * Analyzes upcoming nodes to find the next significant curve
   */
  findNextCurve(currentLat: number, currentLng: number, currentHeading: number, nodes: RoadNode[], lookAheadMeters: number): CurveData | null {
    if (nodes.length < 5) return null;

    // 1. Find the "current" index by proximity
    let closestIdx = 0;
    let minDist = Infinity;
    nodes.forEach((node, idx) => {
      const d = this.haversineDistance(currentLat, currentLng, node.lat, node.lng);
      if (d < minDist) {
        minDist = d;
        closestIdx = idx;
      }
    });

    // 2. Scan ahead for significant curves using a cumulative window
    const WINDOW_METERS = 60; // How much of the road to "sum up" for one curve
    let distanceToScanStart = 0;

    for (let i = closestIdx; i < nodes.length - 3; i++) {
      const d = this.haversineDistance(nodes[i].lat, nodes[i].lng, nodes[i+1].lat, nodes[i+1].lng);
      distanceToScanStart += d;
      
      if (distanceToScanStart > lookAheadMeters) break;

      // Start a "Lookahead Window" from this point
      let cumulativeAngle = 0;
      let windowDist = 0;
      let windowPoints = [nodes[i]];
      let j = i;

      while (j < nodes.length - 2 && windowDist < WINDOW_METERS) {
        const stepDist = this.haversineDistance(nodes[j].lat, nodes[j].lng, nodes[j+1].lat, nodes[j+1].lng);
        windowDist += stepDist;
        
        const angle = this.calculateAngle(nodes[j], nodes[j+1], nodes[j+2]);
        cumulativeAngle += angle;
        windowPoints.push(nodes[j+1]);
        j++;
      }

      // Filter: Only care about curves with "grau maior" (sum > 25 degrees)
      if (Math.abs(cumulativeAngle) > 25) {
        let severity: CurveData['severity'] = 'medium';
        const absoluteAngle = Math.abs(cumulativeAngle);
        
        if (absoluteAngle > 95) severity = 'hairpin';
        else if (absoluteAngle > 55) severity = 'hard';

        return {
          angle: Math.round(absoluteAngle),
          severity,
          distance: Math.round(distanceToScanStart),
          direction: cumulativeAngle > 0 ? 'right' : 'left',
          points: windowPoints.concat(nodes.slice(j, j + 5)) // Include some exit points
        };
      }
    }

    return null;
  }

  haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
}

export const curveService = new CurveAnalysisService();
