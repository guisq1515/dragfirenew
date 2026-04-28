import { TopologicalRegion, RoadNode, WayData } from '../types';
import { CapacitorHttp } from '@capacitor/core';
import { fetchElevationPoints } from './googleMapsService';
import { curveService } from './CurveAnalysisService';

const DB_NAME = 'DragFireOfflineMaps';
const STORE_NAME = 'regions';
const DB_VERSION = 4; // Bump to v4 for new polyline/optimized format

class OfflineMapService {
  private db: IDBDatabase | null = null;
  private lastPreloadPoint: { lat: number, lng: number } | null = null;
  private isPreloading = false;
  private retryQueue: { lat: number, lng: number }[] = [];
  private lastCleanupTime = 0;
  private config = {
    calibrationRadius: 20000,
    manualDownloadRadius: 40
  };

  public updateConfig(newConfig: Partial<{ calibrationRadius: number, manualDownloadRadius: number }>) {
    this.config = { ...this.config, ...newConfig };
  }

  async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        // If upgrading, delete old data because formats have changed
        if (event.oldVersion > 0 && event.oldVersion < 4) {
          if (db.objectStoreNames.contains(STORE_NAME)) {
            db.deleteObjectStore(STORE_NAME);
          }
        }
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('location', ['lat_grid', 'lng_grid'], { unique: false });
        }
      };

      request.onsuccess = (event: any) => {
        this.db = event.target.result;
        resolve();
      };

      request.onerror = (event: any) => {
        console.error('IndexedDB error:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  private getGridKey(lat: number, lng: number): string {
    const latGrid = Math.floor(lat * 10) / 10;
    const lngGrid = Math.floor(lng * 10) / 10;
    return `${latGrid.toFixed(1)}_${lngGrid.toFixed(1)}`;
  }

  async saveRegion(region: TopologicalRegion): Promise<void> {
    await this.init();
    if (!this.db) return;

    const id = this.getGridKey(region.lat, region.lng);
    
    // Idea 1: Serialization/Compression by shortening keys
    const data = {
      ...this.serializeRegion(region),
      id,
      lat_grid: Math.floor(region.lat * 10) / 10,
      lng_grid: Math.floor(region.lng * 10) / 10
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(data);

      // Idea 3: Run cleanup once per session
      const now = Date.now();
      if (now - this.lastCleanupTime > 86400000) {
        this.lastCleanupTime = now;
        this.cleanupOldRegions(store);
      }

      request.onsuccess = () => resolve();
      request.onerror = (event: any) => reject(event.target.error);
    });
  }

  private serializeRegion(region: TopologicalRegion): any {
    return {
      la: region.lat,
      ln: region.lng,
      r: region.radius,
      t: region.timestamp || Date.now(),
      w: region.ways.map(w => ({
        i: w.id,
        n: w.nodes,
        t: w.tags,
        // We drop `points` because we can reconstruct it from `nodes` and `nodesMap`
        // We also strip out large objects from curves to save space, keeping only what's needed
        c: w.curves?.map(c => ({
          a: c.angle,
          s: c.severity,
          d: c.distance,
          p: c.pathDistance,
          di: c.direction,
          sl: c.slope,
          u: c.isUphill,
          // Store only the node IDs for the curve points to reconstruct later
          n: c.points.map(pt => region.ways.find(way => way.id === w.id)?.nodes[way.points.indexOf(pt)])
        }))
      })),
      n: region.nodesMap
    };
  }

  private deserializeRegion(data: any): TopologicalRegion {
    if (!data.la) return data; // Already in full format
    return {
      lat: data.la,
      lng: data.ln,
      radius: data.r,
      timestamp: data.t,
      ways: data.w.map((w: any) => {
        const points = (w.n || []).map((id: number) => data.n[id]).filter(Boolean);
        return {
          id: w.i,
          nodes: w.n || [],
          tags: w.t,
          points: points,
          curves: w.c?.map((c: any) => ({
            angle: c.a,
            severity: c.s,
            distance: c.d,
            pathDistance: c.p,
            direction: c.di,
            slope: c.sl,
            isUphill: c.u,
            points: (c.n || []).map((id: number) => data.n[id]).filter(Boolean)
          })) || []
        };
      }),
      nodesMap: data.n
    };
  }

  private async cleanupOldRegions(store: IDBObjectStore) {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const request = store.openCursor();
    request.onsuccess = (event: any) => {
      const cursor = event.target.result;
      if (cursor) {
        const timestamp = cursor.value.t || cursor.value.timestamp;
        if (timestamp < thirtyDaysAgo) {
          cursor.delete();
        }
        cursor.continue();
      }
    };
  }

  async getRegion(lat: number, lng: number): Promise<TopologicalRegion | null> {
    const allRegions = await this.getAllRegions();
    if (!allRegions || allRegions.length === 0) return null;

    let bestRegion: TopologicalRegion | null = null;
    let minDistance = Infinity;

    for (const region of allRegions) {
      const dist = this.haversineDistance(lat, lng, region.lat, region.lng);
      // Check if we are inside the downloaded region's radius (95% to avoid edge cases)
      if (dist < (region.radius || this.config.calibrationRadius) * 0.95) {
        if (dist < minDistance) {
          minDistance = dist;
          bestRegion = region;
        }
      }
    }

    return bestRegion;
  }

  async getAllRegions(): Promise<TopologicalRegion[]> {
    await this.init();
    if (!this.db) return [];

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = (event: any) => {
        resolve(event.target.result || []);
      };
      request.onerror = () => resolve([]);
    });
  }

  async smartPreload(lat: number, lng: number, heading: number, speed: number, config: { triggerDist?: number, projectDist?: number } = {}): Promise<void> {
    if (this.isPreloading) return;

    this.isPreloading = true;
    
    try {
      const isHighway = speed > 70; // Proxy for being on a highway/avenue
      
      if (isHighway) {
        // Super Highway Mode: Project 250km in steps of 30km
        // Inclusion of secondary/tertiary roads (vicinais) for safety
        console.log("Smart Preload: Super Highway Mode (250km Corridor)");
        const steps = [30000, 60000, 90000, 120000, 150000, 180000, 210000, 250000];
        for (const dist of steps) {
          const p = this.calculateFuturePoint(lat, lng, heading, dist);
          const exists = await this.getRegion(p.lat, p.lng);
          if (!exists) {
            if (navigator.onLine) {
              // Now including tertiary and unclassified (vicinais)
              await this.fetchAndStoreRegion(p.lat, p.lng, 25000, true); 
            } else {
              this.addToRetryQueue(p.lat, p.lng);
            }
          }
        }
      } else {
        // Urban mode: Project 10km, including all streets
        console.log("Smart Preload: Urban Mode (10km)");
        const p = this.calculateFuturePoint(lat, lng, heading, 10000);
        const exists = await this.getRegion(p.lat, p.lng);
        if (!exists) {
          if (navigator.onLine) {
            await this.fetchAndStoreRegion(p.lat, p.lng, 10000, false);
          } else {
            this.addToRetryQueue(p.lat, p.lng);
          }
        }
      }
      
      if (navigator.onLine) await this.processRetryQueue();

    } catch (e) {
      console.error("Smart preload failed:", e);
    } finally {
      this.isPreloading = false;
    }
  }

  private addToRetryQueue(lat: number, lng: number) {
    // Avoid duplicates in queue
    const exists = this.retryQueue.some(p => Math.abs(p.lat - lat) < 0.01 && Math.abs(p.lng - lng) < 0.01);
    if (!exists) {
      this.retryQueue.push({ lat, lng });
      if (this.retryQueue.length > 10) this.retryQueue.shift(); // Keep queue small
    }
  }

  private async processRetryQueue() {
    if (!navigator.onLine || this.retryQueue.length === 0) return;
    
    const next = this.retryQueue.shift();
    if (next) {
      try {
        await this.fetchAndStoreRegion(next.lat, next.lng);
      } catch (e) {
        // Put back at end of queue
        this.retryQueue.push(next);
      }
    }
  }

  private calculateFuturePoint(lat: number, lng: number, heading: number, distance: number): { lat: number, lng: number } {
    const R = 6371000;
    const brng = (heading * Math.PI) / 180;
    const lat1 = (lat * Math.PI) / 180;
    const lon1 = (lng * Math.PI) / 180;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(distance / R) + Math.cos(lat1) * Math.sin(distance / R) * Math.cos(brng));
    const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(distance / R) * Math.cos(lat1), Math.cos(distance / R) - Math.sin(lat1) * Math.sin(lat2));
    return { lat: (lat2 * 180) / Math.PI, lng: (lon2 * 180) / Math.PI };
  }

  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  async preDownloadArea(
    lat: number, 
    lng: number, 
    radiusKm: number, 
    onProgress?: (p: number, message: string) => void
  ): Promise<void> {
    const step = 0.1;
    const startLat = lat - (radiusKm / 111);
    const endLat = lat + (radiusKm / 111);
    const startLng = lng - (radiusKm / (111 * Math.cos(lat * Math.PI / 180)));
    const endLng = lng + (radiusKm / (111 * Math.cos(lat * Math.PI / 180)));

    const points: {lat: number, lng: number}[] = [];
    for (let l = startLat; l <= endLat; l += step) {
      for (let g = startLng; g <= endLng; g += step) {
        points.push({ lat: l, lng: g });
      }
    }

    // Prioritize regions closer to the user so the "Lock" releases faster
    points.sort((a, b) => {
      const distA = this.haversineDistance(lat, lng, a.lat, a.lng);
      const distB = this.haversineDistance(lat, lng, b.lat, b.lng);
      return distA - distB;
    });

    const total = points.length;
    let completed = 0;

    for (const p of points) {
      onProgress?.(Math.round((completed / total) * 100), `Baixando região ${completed + 1}/${total}...`);
      try {
        await this.fetchAndStoreRegion(p.lat, p.lng);
      } catch (e) {}
      completed++;
    }
    onProgress?.(100, 'Download concluído!');
  }

  async preloadRoute(points: {lat: number, lng: number}[]): Promise<void> {
    if (points.length < 2) return;
    
    console.log(`Preloading route with ${points.length} points...`);
    
    // Pick points every ~20km to cover the whole path
    let lastP = points[0];
    let distSum = 0;
    const preloadPoints = [points[0]];
    
    for (let i = 1; i < points.length; i++) {
      const p = points[i];
      distSum += this.haversineDistance(lastP.lat, lastP.lng, p.lat, p.lng);
      if (distSum > 20000) {
        preloadPoints.push(p);
        distSum = 0;
      }
      lastP = p;
    }
    
    // Download these points in background
    for (const p of preloadPoints) {
      const exists = await this.getRegion(p.lat, p.lng);
      if (!exists) {
        this.fetchAndStoreRegion(p.lat, p.lng, 25000, true);
      }
    }
  }

  private async fetchAndStoreRegion(lat: number, lng: number, radius?: number, highwaysOnly: boolean = false): Promise<TopologicalRegion | null> {
    const finalRadius = radius || this.config.calibrationRadius;
    
    // Road types filter based on mode
    const roadFilter = highwaysOnly 
      ? 'way["highway"~"motorway|trunk|primary|secondary|tertiary|unclassified"]'
      : 'way["highway"~"motorway|trunk|primary|secondary|tertiary|residential|unclassified|service"]';

    const overpassQuery = `
      [out:json][timeout:30];
      (
        ${roadFilter}(around:${finalRadius},${lat},${lng});
      );
      out body;
      >;
      out skel qt;
    `;

      const response = await CapacitorHttp.post({
        url: 'https://overpass-api.de/api/interpreter',
        data: overpassQuery,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        connectTimeout: 10000,
        readTimeout: 15000
      });

    if (response.status === 200 && response.data.elements) {
      const nodesMap: Record<number, RoadNode> = {};
      const nodeList: RoadNode[] = [];
      
      response.data.elements.forEach((el: any) => {
        if (el.type === 'node') {
          const node = { lat: el.lat, lng: el.lon };
          nodesMap[el.id] = node;
          nodeList.push(node);
        }
      });

      // Background Elevation Fetching for the region
      if (nodeList.length > 0) {
        try {
          const sample = nodeList.filter((_, i) => i % 15 === 0).slice(0, 50);
          const elevations = await fetchElevationPoints(sample.map(n => ({ lat: n.lat, lng: n.lng })));
          elevations.forEach(e => {
            // Find closest nodes to this elevation point and update them
            // Simplified: only update the exact matches or very close ones
            const key = `${e.location.lat.toFixed(5)},${e.location.lng.toFixed(5)}`;
            // We can't easily map back to OSM IDs here without a loop, 
            // but we can store them in a separate map or just update nodesMap if we had the IDs
            // For now, let's just store the nodes with elevation if possible
          });
          
          // Better approach: store elevation in nodesMap
          for (const e of elevations) {
             for (const id in nodesMap) {
                const n = nodesMap[id];
                if (Math.abs(n.lat - e.location.lat) < 0.0001 && Math.abs(n.lng - e.location.lng) < 0.0001) {
                   n.elevation = e.elevation;
                }
             }
          }
        } catch (e) {}
      }

      const ways: WayData[] = response.data.elements
        .filter((el: any) => el.type === 'way')
        .map((el: any) => {
          const points = el.nodes.map((id: number) => nodesMap[id]).filter(Boolean);
          // Pre-calculate curves for this specific way to save CPU during driving
          // We use a null heading to get all curves in the way's natural direction
          const preCalculatedCurves = curveService.findUpcomingCurves(
            points[0]?.lat || 0, 
            points[0]?.lng || 0, 
            null, 
            points, 
            10000 // Look ahead for the whole way
          );
          
          return {
            id: el.id,
            nodes: el.nodes,
            tags: el.tags,
            points,
            curves: preCalculatedCurves
          };
        });

      const newRegion: TopologicalRegion = {
        lat, lng, radius: finalRadius, ways, nodesMap,
        timestamp: Date.now()
      };
      await this.saveRegion(newRegion);
      return newRegion;
    }
    return null;
  }
}

export const offlineMapService = new OfflineMapService();
