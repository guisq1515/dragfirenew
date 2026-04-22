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
  private isOfflineEnabled = true;

  constructor() {
    this.loadCachedRegions();
  }

  private async loadCachedRegions() {
    try {
      const cached = localStorage.getItem('dragfire_road_cache');
      if (cached) {
        this.regions = JSON.parse(cached);
        console.log(`Loaded ${this.regions.length} regions from cache.`);
      }
    } catch (e) {
      console.error('Failed to load road cache', e);
    }
  }

  private saveRegions() {
    try {
      // Keep only last 5 regions to save space (~10-20MB total)
      const toSave = this.regions.slice(0, 5);
      localStorage.setItem('dragfire_road_cache', JSON.stringify(toSave));
    } catch (e) {
      console.warn('Road cache too large for localStorage, clearing oldest');
      if (this.regions.length > 1) {
        this.regions.pop();
        this.saveRegions();
      }
    }
  }

  /**
   * Gets road geometry, downloading a massive 5km region topographically if needed.
   * Resolves completely offline if within cached regions.
   */
  async getRoadGeometry(lat: number, lng: number): Promise<{ nodes: RoadNode[], roadName: string | null }> {
    // 5km diameter check (2500m radius)
    let activeRegion = this.regions.find(r => this.haversineDistance(lat, lng, r.lat, r.lng) < 3500);

    if (!activeRegion) {
      try {
        // Fetch 5000 meters (5km) for massive offline coverage!
        const radius = 5000;
        const query = `
          [out:json][timeout:30];
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
          
          // Save to local storage for persistent offline
          this.saveRegions();
        }
      } catch (error) {
        console.error('Offline Mode: Using best available data or empty.');
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

    // Find the way closest to the current position
    let bestWay = ways[0];
    let minWayDist = Infinity;

    ways.forEach(w => {
      if (w.nodes) {
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
    
    // Aggressively join ALL segments of the SAME road name in the entire region
    if (roadName) {
      let unusedWays = ways.filter(w => w !== bestWay && w.tags?.name === roadName);
      let added = true;
      
      // Keep joining until no more connected segments are found
      while (added && unusedWays.length > 0) {
        added = false;
        const firstNodeId = orderedNodes[0];
        const lastNodeId = orderedNodes[orderedNodes.length - 1];
        
        for (let i = 0; i < unusedWays.length; i++) {
          const w = unusedWays[i];
          const wFirst = w.nodes[0];
          const wLast = w.nodes[w.nodes.length - 1];
          
          if (wFirst === lastNodeId) {
            orderedNodes.push(...w.nodes.slice(1));
            unusedWays.splice(i, 1);
            added = true; break;
          } else if (wLast === firstNodeId) {
            orderedNodes.unshift(...w.nodes.slice(0, w.nodes.length - 1));
            unusedWays.splice(i, 1);
            added = true; break;
          } else if (wLast === lastNodeId) {
            orderedNodes.push(...[...w.nodes].reverse().slice(1));
            unusedWays.splice(i, 1);
            added = true; break;
          } else if (wFirst === firstNodeId) {
            orderedNodes.unshift(...[...w.nodes].reverse().slice(0, w.nodes.length - 1));
            unusedWays.splice(i, 1);
            added = true; break;
          }
        }
      }
    }

    const fallbackName = roadName || (bestWay.tags?.highway ? `Via ${bestWay.tags.highway.charAt(0).toUpperCase() + bestWay.tags.highway.slice(1)}` : 'Via Desconhecida');
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
   * Analyzes upcoming nodes to find the next significant curves
   */
  findUpcomingCurves(currentLat: number, currentLng: number, currentHeading: number | null, nodes: RoadNode[], lookAheadMeters: number): CurveData[] {
    if (nodes.length < 5) return [];

    const foundCurves: CurveData[] = [];
    const MAX_CURVES = 2;

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

    // 2. Scan ahead
    const WINDOW_METERS = 100;
    let distanceToScanStart = 0;

    let traverseStride = 1;
    if (nodes.length > 1 && currentHeading !== null) {
      let nextIdx = closestIdx < nodes.length - 1 ? closestIdx + 1 : closestIdx - 1;
      const dLat = nodes[nextIdx].lat - nodes[closestIdx].lat;
      const dLng = nodes[nextIdx].lng - nodes[closestIdx].lng;
      let nodeBearing = Math.atan2(dLng, dLat) * (180 / Math.PI);
      nodeBearing = (nodeBearing + 360) % 360;
      
      let diff = Math.abs(currentHeading - nodeBearing);
      if (diff > 180) diff = 360 - diff;
      
      if (closestIdx === nodes.length - 1) {
         traverseStride = diff > 90 ? 1 : -1; 
      } else {
         traverseStride = diff > 90 ? -1 : 1;
      }
    }

    let i = closestIdx;
    while ((traverseStride > 0 ? i < nodes.length - 3 : i > 2) && foundCurves.length < MAX_CURVES) {
      const nextI = i + traverseStride;
      const d = this.haversineDistance(nodes[i].lat, nodes[i].lng, nodes[nextI].lat, nodes[nextI].lng);
      distanceToScanStart += d;
      
      if (distanceToScanStart > lookAheadMeters) break;

      let cumulativeAngle = 0;
      let windowDist = 0;
      let j = i;

      while ((traverseStride > 0 ? j < nodes.length - 2 : j > 1) && windowDist < WINDOW_METERS) {
        const nextJ = j + traverseStride;
        const nextNextJ = j + 2 * traverseStride;

        const stepDist = this.haversineDistance(nodes[j].lat, nodes[j].lng, nodes[nextJ].lat, nodes[nextJ].lng);
        windowDist += stepDist;
        
        const angle = this.calculateAngle(nodes[j], nodes[nextJ], nodes[nextNextJ]);
        cumulativeAngle += angle;
        j += traverseStride;
      }

      const threshold = distanceToScanStart > 1500 ? 8 : 15; 
      
      if (Math.abs(cumulativeAngle) > threshold) {
        let severity: CurveData['severity'] = 'medium';
        const absoluteAngle = Math.abs(cumulativeAngle);
        
        if (absoluteAngle > 95) severity = 'hairpin';
        else if (absoluteAngle > 55) severity = 'hard';
        else if (absoluteAngle < 35) severity = 'soft';

        // Capturar MUITO mais pontos para mostrar a via inteira no minimapa (250 pontos)
        const extendedPoints = traverseStride > 0 
          ? nodes.slice(i, i + 250) 
          : nodes.slice(Math.max(0, i - 250), i + 1).reverse();

        foundCurves.push({
          angle: Math.round(absoluteAngle),
          severity,
          distance: Math.round(distanceToScanStart),
          direction: cumulativeAngle > 0 ? 'right' : 'left',
          points: extendedPoints
        });

        i = j + (5 * traverseStride); 
      } else {
        i += traverseStride;
      }
    }

    // Se não encontrou curvas, mas temos geometria, adicionar uma "Reta" como posterior ou principal
    if (foundCurves.length < 2 && nodes.length > closestIdx + 10) {
       foundCurves.push({
         angle: 0,
         severity: 'straight',
         distance: foundCurves.length > 0 ? foundCurves[0].distance + 500 : 0,
         direction: 'straight',
         points: nodes.slice(closestIdx, closestIdx + 100)
       });
    }

    return foundCurves;
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
