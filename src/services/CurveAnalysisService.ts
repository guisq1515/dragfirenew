import { CapacitorHttp } from '@capacitor/core';

export interface RoadNode {
  lat: number;
  lng: number;
}

export interface CurveData {
  angle: number;
  severity: 'soft' | 'medium' | 'hard' | 'hairpin' | 'straight' | 'chicane' | 's-curve';
  distance: number;
  direction: 'left' | 'right' | 'straight' | 'both';
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
  private activeWayId: number | null = null;
  private activeRoadName: string | null = null;
  private activeNodes: RoadNode[] = [];

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
  async getRoadGeometry(lat: number, lng: number, heading: number | null = null, speedKmh: number = 0): Promise<{ nodes: RoadNode[], roadName: string | null }> {
    // 20km diameter check (10000m radius for triggering new fetch)
    // We stay in the active region if within 10km of its center
    let activeRegion = this.regions.find(r => this.haversineDistance(lat, lng, r.lat, r.lng) < 10000);

    if (!activeRegion) {
      try {
        // Fetch massive 20km region for total offline security!
        const radius = 20000;
        const query = `
          [out:json][timeout:60];
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
        console.warn('Offline Mode: Fetch failed, looking for any available cached region...');
        activeRegion = this.regions.find(r => this.haversineDistance(lat, lng, r.lat, r.lng) < 20000);
      }
    }

    if (activeRegion) {
      return this.stitchLocalRoad(lat, lng, heading, speedKmh, activeRegion);
    }
    return { nodes: [], roadName: null };
  }

  private stitchLocalRoad(lat: number, lng: number, heading: number | null, speedKmh: number, region: TopologicalRegion): { nodes: RoadNode[], roadName: string | null } {
    const { ways, nodesMap } = region;
    let bestWay = ways[0];
    let minWayDist = Infinity;
    const HEADING_TOLERANCE = 45; // degrees

    ways.forEach(w => {
      // Find distance to this way
      let d = Infinity;
      let wayBearing = 0;
      
      for (let i = 0; i < w.nodes.length - 1; i++) {
        const n1 = nodesMap[w.nodes[i]];
        const n2 = nodesMap[w.nodes[i + 1]];
        if (!n1 || !n2) continue;
        
        const dist = this.haversineDistance(lat, lng, n1.lat, n1.lng);
        if (dist < d) {
          d = dist;
          // Calculate bearing of this segment
          const dLat = n2.lat - n1.lat;
          const dLng = n2.lng - n1.lng;
          wayBearing = (Math.atan2(dLng, dLat) * 180 / Math.PI + 360) % 360;
        }
      }

      // Heading-Aware Penalty: If moving fast, penalize roads with different orientation
      let penalty = 0;
      if (heading !== null && speedKmh > 20) {
        let diff = Math.abs(heading - wayBearing);
        if (diff > 180) diff = 360 - diff;
        
        // Also check opposite direction (two-way roads)
        let diffOpposite = Math.abs(heading - ((wayBearing + 180) % 360));
        if (diffOpposite > 180) diffOpposite = 360 - diffOpposite;
        
        const minDiff = Math.min(diff, diffOpposite);
        if (minDiff > HEADING_TOLERANCE) {
          penalty = minDiff * 2; // Strong penalty for roads in wrong direction
        }
      }

      const score = d + penalty;
      if (score < minWayDist) {
        minWayDist = score;
        bestWay = w;
      }
    });

    const roadName = bestWay.tags?.name;
    const wayId = bestWay.id;

    // Hysteresis: If we have an active way and the closest way is just a jitter, stay on active
    if (this.activeWayId && wayId !== this.activeWayId && minWayDist < 15) {
       // Only switch if the new way is actually better and we are somewhat far from the old one
       // Or if the road name changed significantly
       if (roadName !== this.activeRoadName) {
          this.activeWayId = wayId;
          this.activeRoadName = roadName;
       }
    } else {
       this.activeWayId = wayId;
       this.activeRoadName = roadName;
    }

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
    
    this.activeNodes = roadNodes;
    return { nodes: roadNodes, roadName: fallbackName };
  }

  /**
   * Snaps a GPS point to the nearest segment of the currently active road nodes.
   * This prevents "lane jumping" and visual jitter in the minimap.
   */
  snapToRoad(lat: number, lng: number): RoadNode {
    if (this.activeNodes.length < 2) return { lat, lng };

    let bestPoint = { lat, lng };
    let minSnapDist = Infinity;

    for (let i = 0; i < this.activeNodes.length - 1; i++) {
      const p1 = this.activeNodes[i];
      const p2 = this.activeNodes[i + 1];
      
      const snapped = this.projectPointOnSegment({ lat, lng }, p1, p2);
      const d = this.haversineDistance(lat, lng, snapped.lat, snapped.lng);
      
      if (d < minSnapDist) {
        minSnapDist = d;
        bestPoint = snapped;
      }
    }

    // Only snap if we are within 25 meters of the road (Waze-like tolerance)
    return minSnapDist < 25 ? bestPoint : { lat, lng };
  }

  private projectPointOnSegment(p: RoadNode, a: RoadNode, b: RoadNode): RoadNode {
    const atob = { lat: b.lat - a.lat, lng: b.lng - a.lng };
    const atop = { lat: p.lat - a.lat, lng: p.lng - a.lng };
    const len2 = atob.lat * atob.lat + atob.lng * atob.lng;
    
    if (len2 === 0) return a;
    
    let t = (atop.lat * atob.lat + atop.lng * atob.lng) / len2;
    t = Math.max(0, Math.min(1, t));
    
    return {
      lat: a.lat + t * atob.lat,
      lng: a.lng + t * atob.lng
    };
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
  findUpcomingCurves(currentLat: number, currentLng: number, currentHeading: number | null, nodes: RoadNode[], lookAheadMeters: number, speedKmh: number = 0): CurveData[] {
    if (nodes.length < 5) return [];

    const foundCurves: CurveData[] = [];
    const MAX_CURVES = 3;

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

      const threshold = speedKmh > 100 ? 10 : (distanceToScanStart > 1500 ? 8 : 15); 
      
      if (Math.abs(cumulativeAngle) > threshold) {
        let severity: CurveData['severity'] = 'medium';
        const absoluteAngle = Math.abs(cumulativeAngle);
        
        // Context-Aware Severity: Thresholds drop as speed increases
        const speedFactor = Math.max(1, speedKmh / 60);
        const dynamicAngle = absoluteAngle * speedFactor;

        if (dynamicAngle > 140) severity = 'hairpin';
        else if (dynamicAngle > 90) severity = 'hard';
        else if (dynamicAngle < 40) severity = 'soft';

        // Detecção de Combo (S-Curve / Chicane)
        let direction: CurveData['direction'] = cumulativeAngle > 0 ? 'right' : 'left';
        
        // Look ahead for counter-curve within 80 meters
        let k = j;
        let counterDist = 0;
        let counterAngle = 0;
        while ((traverseStride > 0 ? k < nodes.length - 2 : k > 1) && counterDist < 80) {
           const nK = k + traverseStride;
           const nNK = k + 2 * traverseStride;
           counterDist += this.haversineDistance(nodes[k].lat, nodes[k].lng, nodes[nK].lat, nodes[nK].lng);
           counterAngle += this.calculateAngle(nodes[k], nodes[nK], nodes[nNK]);
           
           // If we find a significant angle in the opposite direction
           if (Math.abs(counterAngle) > 20 && Math.sign(counterAngle) !== Math.sign(cumulativeAngle)) {
              severity = 's-curve';
              direction = 'both';
              j = k; // Jump to end of combo
              break;
           }
           k += traverseStride;
        }

        const extendedPoints = traverseStride > 0 
          ? nodes.slice(i, i + 250) 
          : nodes.slice(Math.max(0, i - 250), i + 1).reverse();

        foundCurves.push({
          angle: Math.round(absoluteAngle),
          severity,
          distance: Math.round(distanceToScanStart),
          direction,
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
