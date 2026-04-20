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

export interface TopologicalRegion {
  lat: number;
  lng: number;
  radius: number;
  ways: any[];
  nodesMap: Record<number, RoadNode>;
}

class CurveAnalysisService {
  private regions: TopologicalRegion[] = [];

  /**
   * Gets road geometry, downloading a large region topographically if needed, 
   * or resolving offline from memory if within a cached region.
   */
  async getRoadGeometry(lat: number, lng: number): Promise<{ nodes: RoadNode[], roadName: string | null }> {
    // Use 2000 meters (2km) radius, giving a 4km diameter grid!
    // Safe margin: if user is within 1500m of the center, use region.
    let activeRegion = this.regions.find(r => this.haversineDistance(lat, lng, r.lat, r.lng) < 1500);

    if (!activeRegion) {
      try {
        const radius = 2000;
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
            if (el.type === 'node') nodesMap[el.id] = { lat: el.lat, lng: el.lon };
            else if (el.type === 'way') ways.push(el);
          });
          
          activeRegion = { lat, lng, radius, ways, nodesMap };
          this.regions.unshift(activeRegion);
          
          // Garbage Collection: Keeping only last 2 massive regions to save RAM
          if (this.regions.length > 2) this.regions.pop();
        }
      } catch (error) {
        console.error('Error fetching Massive Region Overpass data:', error);
      }
    }

    if (activeRegion) {
      return this.stitchLocalRoad(lat, lng, activeRegion);
    }
    return { nodes: [], roadName: null };
  }

  private stitchLocalRoad(lat: number, lng: number, region: TopologicalRegion): { nodes: RoadNode[], roadName: string | null } {
    const { ways, nodesMap } = region;
    if (ways.length === 0) return { nodes: [], roadName: null };

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

          const roadName = bestWay.tags?.name;
          let orderedNodes = [...bestWay.nodes];
          
          if (roadName) {
             let unusedWays = ways.filter(w => w !== bestWay && w.tags?.name === roadName);
             let added = true;
             while (added && unusedWays.length > 0) {
                added = false;
                const firstNode = orderedNodes[0];
                const lastNode = orderedNodes[orderedNodes.length - 1];
                
                for (let i = 0; i < unusedWays.length; i++) {
                   const w = unusedWays[i];
                   const wFirst = w.nodes[0];
                   const wLast = w.nodes[w.nodes.length - 1];
                   
                   if (wFirst === lastNode) {
                      orderedNodes.push(...w.nodes.slice(1));
                      unusedWays.splice(i, 1);
                      added = true; break;
                   } else if (wLast === firstNode) {
                      orderedNodes.unshift(...w.nodes.slice(0, w.nodes.length - 1));
                      unusedWays.splice(i, 1);
                      added = true; break;
                   } else if (wLast === lastNode) {
                      orderedNodes.push(...[...w.nodes].reverse().slice(1));
                      unusedWays.splice(i, 1);
                      added = true; break;
                   } else if (wFirst === firstNode) {
                      orderedNodes.unshift(...[...w.nodes].reverse().slice(0, w.nodes.length - 1));
                      unusedWays.splice(i, 1);
                      added = true; break;
                   }
                }
             }
          }

          const fallbackName = roadName || (bestWay.tags?.highway ? `Via ${bestWay.tags.highway.charAt(0).toUpperCase() + bestWay.tags.highway.slice(1)}` : null);
          const roadNodes = orderedNodes.map((id: number) => nodesMap[id]).filter(Boolean);
          return { nodes: roadNodes, roadName: fallbackName };
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
  findNextCurve(currentLat: number, currentLng: number, currentHeading: number | null, nodes: RoadNode[], lookAheadMeters: number): CurveData | null {
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
    const WINDOW_METERS = 50; // Reduzido ligeiramente para detecção mais ágil
    let distanceToScanStart = 0;

    // Determine array traversal direction based on heading comparison
    let traverseStride = 1;
    if (nodes.length > 1 && currentHeading !== null) {
      let nextIdx = closestIdx < nodes.length - 1 ? closestIdx + 1 : closestIdx - 1;
      const dLat = nodes[nextIdx].lat - nodes[closestIdx].lat;
      const dLng = nodes[nextIdx].lng - nodes[closestIdx].lng;
      let nodeBearing = Math.atan2(dLng, dLat) * (180 / Math.PI);
      nodeBearing = (nodeBearing + 360) % 360;
      
      let diff = Math.abs(currentHeading - nodeBearing);
      if (diff > 180) diff = 360 - diff;
      
      // If we used closestIdx - 1, the bearing is backwards. We flip logic.
      if (closestIdx === nodes.length - 1) {
         traverseStride = diff > 90 ? 1 : -1; 
      } else {
         traverseStride = diff > 90 ? -1 : 1;
      }
    }

    for (let i = closestIdx; (traverseStride > 0 ? i < nodes.length - 3 : i > 2); i += traverseStride) {
      const nextI = i + traverseStride;
      const d = this.haversineDistance(nodes[i].lat, nodes[i].lng, nodes[nextI].lat, nodes[nextI].lng);
      distanceToScanStart += d;
      
      if (distanceToScanStart > lookAheadMeters) break;

      // Start a "Lookahead Window" from this point
      let cumulativeAngle = 0;
      let windowDist = 0;
      let windowPoints = [nodes[i]];
      let j = i;

      while ((traverseStride > 0 ? j < nodes.length - 2 : j > 1) && windowDist < WINDOW_METERS) {
        const nextJ = j + traverseStride;
        const nextNextJ = j + 2 * traverseStride;

        const stepDist = this.haversineDistance(nodes[j].lat, nodes[j].lng, nodes[nextJ].lat, nodes[nextJ].lng);
        windowDist += stepDist;
        
        const angle = this.calculateAngle(nodes[j], nodes[nextJ], nodes[nextNextJ]);
        cumulativeAngle += angle;
        windowPoints.push(nodes[nextJ]);
        j += traverseStride;
      }

      // Filter: Only care about curves with "grau maior"
      // Dynamic threshold: if far away, even 15 degrees might be worth showing as "upcoming"
      const threshold = distanceToScanStart > 300 ? 15 : 25;
      
      if (Math.abs(cumulativeAngle) > threshold) {
        let severity: CurveData['severity'] = 'medium';
        const absoluteAngle = Math.abs(cumulativeAngle);
        
        if (absoluteAngle > 95) severity = 'hairpin';
        else if (absoluteAngle > 55) severity = 'hard';
        else if (absoluteAngle < 35) severity = 'soft';

        return {
          angle: Math.round(absoluteAngle),
          severity,
          distance: Math.round(distanceToScanStart),
          direction: cumulativeAngle > 0 ? 'right' : 'left',
          points: windowPoints.concat(traverseStride > 0 ? nodes.slice(j, j + 15) : nodes.slice(Math.max(0, j - 15), j).reverse())
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
