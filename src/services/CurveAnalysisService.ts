import { CapacitorHttp } from '@capacitor/core';
import { RoadNode, WayData, CurveData, TopologicalRegion } from '../types';
import { offlineMapService } from './OfflineMapService';

class CurveAnalysisService {
  private regions: TopologicalRegion[] = [];
  private activeWayId: number | null = null;
  private activeRoadName: string | null = null;
  private activeNodes: RoadNode[] = [];
  private allRegionalNodes: RoadNode[][] = [];
  private lastFetchAttemptTime: number = 0;

  // Admin Configurable Thresholds
  private detectionThreshold = 15;
  private mediumThreshold = 45;
  private hardThreshold = 90;
  private cacheRadius = 7500;

  constructor() {}

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

  async getRoadGeometry(lat: number, lng: number, heading: number | null = null, speedKmh: number = 0): Promise<{ 
    nodes: RoadNode[], 
    roadName: string | null, 
    allWays: RoadNode[][],
    preCalculatedCurves?: CurveData[]
  }> {
    // 1. Check in-memory cache (respecting the region's actual downloaded radius)
    let activeRegion = this.regions.find(r => this.haversineDistance(lat, lng, r.lat, r.lng) < (r.radius || 5000) * 0.95);

    // 2. Check OfflineMapService (IndexedDB)
    if (!activeRegion) {
      const offline = await offlineMapService.getRegion(lat, lng);
      if (offline) {
        activeRegion = offline;
        // Also add to in-memory for faster access
        this.regions = [offline, ...this.regions].slice(0, 5);
      }
    }

    // 3. Trigger background fetch if needed
    const now = Date.now();
    if ((!activeRegion || (now - activeRegion.timestamp > 86400000)) && (now - this.lastFetchAttemptTime > 15000)) {
      this.lastFetchAttemptTime = now;
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
      const radius = 5000; // Reduced from 7500 for faster calibration
      const overpassQuery = `
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
        data: overpassQuery,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        connectTimeout: 5000,
        readTimeout: 15000
      });

      if (response.status === 200 && response.data.elements) {
        const nodesMap: Record<number, RoadNode> = {};
        const elements = response.data.elements;
        
        elements.forEach((el: any) => {
          if (el.type === 'node') {
            nodesMap[el.id] = { lat: el.lat, lng: el.lon };
          }
        });

        const ways: WayData[] = elements
          .filter((el: any) => el.type === 'way')
          .map((el: any) => {
            const points = el.nodes.map((id: number) => nodesMap[id]).filter(Boolean);
            // Pre-calculate curves in the background
            const curves = this.findUpcomingCurves(points[0]?.lat || 0, points[0]?.lng || 0, null, points, 10000);
            return {
              id: el.id,
              nodes: el.nodes,
              tags: el.tags,
              points,
              curves
            };
          });

        const newRegion: TopologicalRegion = {
          lat, lng, radius, ways, nodesMap,
          timestamp: Date.now()
        };

        this.regions = [newRegion, ...this.regions.filter(r => this.haversineDistance(lat, lng, r.lat, r.lng) > 5000)].slice(0, 5);
        
        // Save to persistent storage
        await offlineMapService.saveRegion(newRegion);
      }
    } catch (e) {}
  }

  private stitchLocalRoad(lat: number, lng: number, heading: number | null, speedKmh: number, region: TopologicalRegion): { 
    nodes: RoadNode[], 
    roadName: string | null,
    preCalculatedCurves?: CurveData[]
  } {
    const { ways, nodesMap } = region;
    let bestWay: WayData | null = null;
    let minScore = Infinity;

    ways.forEach(w => {
      let minDist = Infinity;
      let segmentHeading = 0;

      // Find closest segment and its heading
      for (let i = 0; i < w.points.length - 1; i++) {
        const p1 = w.points[i];
        const p2 = w.points[i+1];
        const snapped = this.projectPointOnSegment({ lat, lng }, p1, p2);
        const dist = this.haversineDistance(lat, lng, snapped.lat, snapped.lng);
        
        if (dist < minDist) {
          minDist = dist;
          segmentHeading = this.calculateHeading(p1, p2);
        }
      }

      if (minDist < 60) {
        let hScore = 0;
        if (heading !== null) {
          let diff = Math.abs(heading - segmentHeading);
          if (diff > 180) diff = 360 - diff;
          // Reverse direction check (one-way or just driving backwards on OSM data)
          let revDiff = Math.abs(heading - (segmentHeading + 180) % 360);
          if (revDiff > 180) revDiff = 360 - revDiff;
          hScore = Math.min(diff, revDiff);
        }

        // Hysteresis: Give a significant bonus to the currently active road
        const isCurrentRoad = w.id === this.activeWayId;
        const hysteresisBonus = isCurrentRoad ? -20 : 0; // Increased to 20 meters "advantage"

        // Increased heading weight (1.2 instead of 1.0) to better handle crossroads
        const totalScore = minDist + (hScore * 1.2) + hysteresisBonus;
        
        if (totalScore < minScore) {
          minScore = totalScore;
          bestWay = w;
        }
      }
    });

    if (!bestWay || !(bestWay as WayData).nodes || (bestWay as WayData).nodes.length === 0) {
      this.activeNodes = [];
      this.activeRoadName = null;
      this.activeWayId = null;
      return { nodes: [], roadName: null };
    }
    const roadName = (bestWay as WayData).tags?.name || (bestWay as WayData).tags?.ref || 'Via Mapeada';
    
    // Smooth transition: only update if the new way is significantly better or we have no current road
    if (!this.activeWayId || minScore < 20 || (bestWay as WayData).id === this.activeWayId) {
      this.activeRoadName = roadName;
      this.activeWayId = (bestWay as WayData).id;
    }

    let orderedNodes = [...(bestWay as WayData).nodes];
    let joinedWays = new Set([(bestWay as WayData).id]);
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

    let isReversed = false;
    // FIX: Check if heading is inverted relative to the stitched nodes
    if (heading !== null && this.activeNodes.length >= 2) {
      // Calculate average heading of the first few segments to get the general direction
      const p1 = this.activeNodes[0];
      const p2 = this.activeNodes[Math.min(5, this.activeNodes.length - 1)];
      const roadHeading = this.calculateHeading(p1, p2);
      
      let diff = Math.abs(heading - roadHeading);
      if (diff > 180) diff = 360 - diff;
      
      if (diff > 90) {
        // Vehicle is driving in the opposite direction of the node array
        this.activeNodes.reverse();
        isReversed = true;
      }
    }

    return { 
      nodes: this.activeNodes, 
      roadName: this.activeRoadName,
      preCalculatedCurves: isReversed ? undefined : (bestWay as WayData).curves 
    };
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

  public calculateHeading(p1: RoadNode, p2: RoadNode): number {
    const y = Math.sin((p2.lng - p1.lng) * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180);
    const x = Math.cos(p1.lat * Math.PI / 180) * Math.sin(p2.lat * Math.PI / 180) - Math.sin(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) * Math.cos((p2.lng - p1.lng) * Math.PI / 180);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  findUpcomingCurves(currentLat: number, currentLng: number, currentHeading: number | null, nodes: RoadNode[], lookAheadMeters: number, speedKmh: number = 0): CurveData[] {
    if (nodes.length < 5) return [];
    const found: CurveData[] = [];
    let closest = 0, minDist = Infinity;
    nodes.forEach((n, idx) => { const d = this.haversineDistance(currentLat, currentLng, n.lat, n.lng); if (d < minDist) { minDist = d; closest = idx; } });

    let i = closest, scan = 0;
    while (i < nodes.length - 3 && found.length < 5) {
      scan += this.haversineDistance(nodes[i].lat, nodes[i].lng, nodes[i+1].lat, nodes[i+1].lng);
      if (scan > lookAheadMeters) break;

      let cumAngle = 0, win = 0, j = i;
      let signChanges = 0, lastAngle = 0;
      
      while (j < nodes.length - 2 && win < 150) {
        win += this.haversineDistance(nodes[j].lat, nodes[j].lng, nodes[j+1].lat, nodes[j+1].lng);
        const v1 = { x: nodes[j+1].lng - nodes[j].lng, y: nodes[j+1].lat - nodes[j].lat };
        const v2 = { x: nodes[j+2].lng - nodes[j+1].lng, y: nodes[j+2].lat - nodes[j+1].lat };
        const dot = v1.x * v2.x + v1.y * v2.y;
        const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y), mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
        
        if (mag1 > 0 && mag2 > 0) {
           const angle = Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2)))) * (180 / Math.PI);
           const currentSign = (v1.x * v2.y - v1.y * v2.x) < 0 ? 1 : -1;
           const signedAngle = currentSign * angle;
           
           if (lastAngle !== 0 && Math.sign(signedAngle) !== Math.sign(lastAngle) && Math.abs(signedAngle) > 5) {
              signChanges++;
           }
           
           cumAngle += signedAngle;
           lastAngle = signedAngle;
        }
        j++;
      }

      const dynamicThreshold = speedKmh > 80 ? (this.detectionThreshold * 0.7) : this.detectionThreshold;
      
      if (Math.abs(cumAngle) > dynamicThreshold || signChanges >= 2) {
        const startE = nodes[i].elevation, endE = nodes[j].elevation;
        let slope = 0;
        if (startE !== undefined && endE !== undefined) slope = ((endE - startE) / win) * 100;

        let type: CurveData['severity'] = 'soft';
        const absAngle = Math.abs(cumAngle);
        
        if (signChanges >= 2) type = 'chicane';
        else if (absAngle > 140) type = 'hairpin';
        else if (absAngle > this.hardThreshold) type = 'hard';
        else if (absAngle > this.mediumThreshold) type = 'medium';
        else if (absAngle < 10) type = 'straight';

        found.push({
          angle: Math.round(absAngle),
          severity: type,
          distance: Math.round(scan),
          direction: cumAngle > 0 ? 'right' : 'left',
          points: nodes.slice(i, j + 1),
          slope: Math.round(slope),
          isUphill: slope > 1.5
        });
        i = j; // Move exactly to where the curve ended
      } else {
        i++;
      }
    }
    return found;
  }

  public clearCache() {
    this.regions = [];
    this.activeRoadName = null;
    this.activeWayId = null;
  }
}

export const curveService = new CurveAnalysisService();
