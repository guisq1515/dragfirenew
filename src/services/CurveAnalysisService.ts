import { CapacitorHttp } from '@capacitor/core';

export interface RoadNode {
  lat: number;
  lng: number;
  elevation?: number;
}

export interface CurveData {
  angle: number;
  severity: 'soft' | 'medium' | 'hard' | 'hairpin' | 'straight' | 'chicane' | 's-curve';
  distance: number;
  direction: 'left' | 'right' | 'straight' | 'both';
  points: RoadNode[];
  slope?: number;
  isUphill?: boolean;
}

export interface WayData {
  id: number;
  nodes: number[];
  tags: any;
  points: RoadNode[];
}

export interface TopologicalRegion {
  lat: number;
  lng: number;
  radius: number;
  ways: WayData[];
  nodesMap: Record<number, RoadNode>;
  timestamp: number;
}

class CurveAnalysisService {
  private regions: TopologicalRegion[] = [];
  private activeWayId: number | null = null;
  private activeRoadName: string | null = null;
  private activeNodes: RoadNode[] = [];
  private allRegionalNodes: RoadNode[][] = [];

  // Admin Configurable Thresholds
  private detectionThreshold = 15;
  private mediumThreshold = 45;
  private hardThreshold = 90;
  private cacheRadius = 7500;

  constructor() {
    this.loadCachedRegions();
  }

  public updateConfig(config: { 
    detectionThreshold?: number, 
    mediumThreshold?: number, 
    hardThreshold?: number,
    cacheRadius?: number 
  }) {
    if (config.detectionThreshold !== undefined) this.detectionThreshold = config.detectionThreshold;
    if (config.mediumThreshold !== undefined) this.mediumThreshold = config.mediumThreshold;
    if (config.hardThreshold !== undefined) this.hardThreshold = config.hardThreshold;
    if (config.cacheRadius !== undefined) this.cacheRadius = config.cacheRadius;
  }

  private async loadCachedRegions() {
    try {
      const cached = localStorage.getItem('dragfire_road_cache_v2');
      if (cached) {
        this.regions = JSON.parse(cached);
      }
    } catch (e) {}
  }

  private saveRegions() {
    try {
      const toSave = this.regions.slice(0, 10);
      localStorage.setItem('dragfire_road_cache_v2', JSON.stringify(toSave));
    } catch (e) {}
  }

  async getRoadGeometry(lat: number, lng: number, heading: number | null = null, speedKmh: number = 0): Promise<{ nodes: RoadNode[], roadName: string | null, allWays: RoadNode[][] }> {
    let activeRegion = this.regions.find(r => this.haversineDistance(lat, lng, r.lat, r.lng) < 5000);

    if (!activeRegion || (Date.now() - activeRegion.timestamp > 86400000)) {
      this.fetchRegionInBackground(lat, lng);
    }

    if (!activeRegion && this.regions.length > 0) activeRegion = this.regions[0];

    if (activeRegion) {
      const result = this.stitchLocalRoad(lat, lng, heading, speedKmh, activeRegion);
      this.allRegionalNodes = activeRegion.ways.map(w => w.points);
      return { ...result, allWays: this.allRegionalNodes };
    }

    return { nodes: this.activeNodes, roadName: this.activeRoadName, allWays: this.allRegionalNodes };
  }

  private async fetchRegionInBackground(lat: number, lng: number) {
    try {
      const radius = this.cacheRadius; 
      const query = `[out:json][timeout:30];(way["highway"](around:${radius},${lat},${lng})["highway"!~"footway|pedestrian|cycleway|service|path|steps|track"];);out body;>;out skel qt;`;
      const response = await CapacitorHttp.post({ url: 'https://overpass-api.de/api/interpreter', data: query, headers: { 'Content-Type': 'text/plain' } });

      if (response.status === 200 && response.data.elements) {
        const nodesMap: Record<number, RoadNode> = {};
        const ways: WayData[] = [];
        response.data.elements.forEach((el: any) => { if (el.type === 'node') nodesMap[el.id] = { lat: el.lat, lng: el.lon }; });
        response.data.elements.forEach((el: any) => {
          if (el.type === 'way') {
            const points = el.nodes.map((nid: number) => nodesMap[nid]).filter(Boolean);
            if (points.length > 1) ways.push({ id: el.id, nodes: el.nodes, tags: el.tags, points });
          }
        });

        const newRegion: TopologicalRegion = { lat, lng, radius, ways, nodesMap, timestamp: Date.now() };
        this.regions = this.regions.filter(r => this.haversineDistance(lat, lng, r.lat, r.lng) > 2000);
        this.regions.unshift(newRegion);
        this.saveRegions();
      }
    } catch (error) {}
  }

  private stitchLocalRoad(lat: number, lng: number, heading: number | null, speedKmh: number, region: TopologicalRegion): { nodes: RoadNode[], roadName: string | null } {
    const { ways, nodesMap } = region;
    let bestWay: WayData | null = null;
    let minScore = Infinity;

    ways.forEach(w => {
      let d = Infinity;
      let wayBearing = 0;
      for (let i = 0; i < w.points.length - 1; i++) {
        const n1 = w.points[i];
        const dist = this.haversineDistance(lat, lng, n1.lat, n1.lng);
        if (dist < d) {
          d = dist;
          const dLat = w.points[i+1].lat - n1.lat;
          const dLng = w.points[i+1].lng - n1.lng;
          wayBearing = (Math.atan2(dLng, dLat) * 180 / Math.PI + 360) % 360;
        }
      }
      let penalty = 0;
      if (heading !== null && speedKmh > 15) {
        let diff = Math.min(Math.abs(heading - wayBearing), 360 - Math.abs(heading - wayBearing));
        let diffOpp = Math.min(Math.abs(heading - ((wayBearing + 180) % 360)), 360 - Math.abs(heading - ((wayBearing + 180) % 360)));
        if (Math.min(diff, diffOpp) > 45) penalty = Math.min(diff, diffOpp) * 5;
      }
      if ((d + penalty) < minScore) { minScore = d + penalty; bestWay = w; }
    });

    if (!bestWay) return { nodes: this.activeNodes, roadName: this.activeRoadName };
    const roadName = bestWay.tags?.name || bestWay.tags?.ref || 'Via Mapeada';
    
    if (this.activeRoadName && roadName !== this.activeRoadName && minScore < 30) {
       // Keep old name if very close
    } else {
       this.activeRoadName = roadName;
       this.activeWayId = bestWay.id;
    }

    let orderedNodes = [...bestWay.nodes];
    let joinedWays = new Set([bestWay.id]);
    let added = true;
    while (added) {
      added = false;
      const first = orderedNodes[0];
      const last = orderedNodes[orderedNodes.length - 1];
      for (const w of ways) {
        if (joinedWays.has(w.id)) continue;
        const wF = w.nodes[0], wL = w.nodes[w.nodes.length - 1];
        if (wF === last) { orderedNodes.push(...w.nodes.slice(1)); joinedWays.add(w.id); added = true; break; }
        else if (wL === first) { orderedNodes.unshift(...w.nodes.slice(0, -1)); joinedWays.add(w.id); added = true; break; }
        else if (wL === last) { orderedNodes.push(...[...w.nodes].reverse().slice(1)); joinedWays.add(w.id); added = true; break; }
        else if (wF === first) { orderedNodes.unshift(...[...w.nodes].reverse().slice(0, -1)); joinedWays.add(w.id); added = true; break; }
      }
    }

    this.activeNodes = orderedNodes.map(id => nodesMap[id]).filter(Boolean);
    return { nodes: this.activeNodes, roadName: this.activeRoadName };
  }

  snapToRoad(lat: number, lng: number): RoadNode {
    if (this.activeNodes.length < 2) return { lat, lng };
    let best = { lat, lng }, minD = Infinity;
    for (let i = 0; i < this.activeNodes.length - 1; i++) {
      const snapped = this.projectPointOnSegment({ lat, lng }, this.activeNodes[i], this.activeNodes[i+1]);
      const d = this.haversineDistance(lat, lng, snapped.lat, snapped.lng);
      if (d < minD) { minD = d; best = snapped; }
    }
    return minD < 30 ? best : { lat, lng };
  }

  private projectPointOnSegment(p: RoadNode, a: RoadNode, b: RoadNode): RoadNode {
    const atob = { lat: b.lat - a.lat, lng: b.lng - a.lng };
    const atop = { lat: p.lat - a.lat, lng: p.lng - a.lng };
    const len2 = atob.lat * atob.lat + atob.lng * atob.lng;
    if (len2 === 0) return a;
    let t = Math.max(0, Math.min(1, (atop.lat * atob.lat + atop.lng * atob.lng) / len2));
    return { lat: a.lat + t * atob.lat, lng: a.lng + t * atob.lng };
  }

  haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  findUpcomingCurves(currentLat: number, currentLng: number, currentHeading: number | null, nodes: RoadNode[], lookAheadMeters: number, speedKmh: number = 0): CurveData[] {
    if (nodes.length < 5) return [];
    const found: CurveData[] = [];
    let closest = 0, minDist = Infinity;
    nodes.forEach((n, idx) => { const d = this.haversineDistance(currentLat, currentLng, n.lat, n.lng); if (d < minDist) { minDist = d; closest = idx; } });

    let i = closest, scan = 0;
    while (i < nodes.length - 3 && found.length < 3) {
      scan += this.haversineDistance(nodes[i].lat, nodes[i].lng, nodes[i+1].lat, nodes[i+1].lng);
      if (scan > lookAheadMeters) break;

      let cumAngle = 0, win = 0, j = i;
      while (j < nodes.length - 2 && win < 100) {
        win += this.haversineDistance(nodes[j].lat, nodes[j].lng, nodes[j+1].lat, nodes[j+1].lng);
        const v1 = { x: nodes[j+1].lng - nodes[j].lng, y: nodes[j+1].lat - nodes[j].lat };
        const v2 = { x: nodes[j+2].lng - nodes[j+1].lng, y: nodes[j+2].lat - nodes[j+1].lat };
        const dot = v1.x * v2.x + v1.y * v2.y;
        const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y), mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
        if (mag1 > 0 && mag2 > 0) {
           const angle = Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2)))) * (180 / Math.PI);
           cumAngle += (v1.x * v2.y - v1.y * v2.x) < 0 ? angle : -angle;
        }
        j++;
      }

      // Detection Threshold (Dynamic based on speed)
      const dynamicThreshold = speedKmh > 80 ? (this.detectionThreshold * 0.7) : this.detectionThreshold;
      
      if (Math.abs(cumAngle) > dynamicThreshold) {
        // Simple slope calculation if elevation is present
        const startE = nodes[i].elevation, endE = nodes[j].elevation;
        let slope = 0;
        if (startE !== undefined && endE !== undefined) slope = ((endE - startE) / win) * 100;

        found.push({
          angle: Math.round(Math.abs(cumAngle)),
          severity: Math.abs(cumAngle) > this.hardThreshold ? 'hard' : (Math.abs(cumAngle) > this.mediumThreshold ? 'medium' : 'soft'),
          distance: Math.round(scan),
          direction: cumAngle > 0 ? 'right' : 'left',
          points: nodes.slice(i, i + 50),
          slope: Math.round(slope),
          isUphill: slope > 1.5
        });
        i = j + 5;
      } else i++;
    }
    return found;
  }
}

export const curveService = new CurveAnalysisService();
