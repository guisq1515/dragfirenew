import { CapacitorHttp, Capacitor } from '@capacitor/core';
import { db } from '../firebase';
import { doc, setDoc, increment, getDoc } from 'firebase/firestore';

// Vite uses import.meta.env for environment variables
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyDWqsCxj7uc2Iu_J3JNPcgti5K7HNWjpY8';
const IS_DEV = import.meta.env.DEV;
const API_BASE = IS_DEV ? '/google-maps-api' : 'https://maps.googleapis.com';

/**
 * API Security Configurations
 */
const DEFAULT_LIMITS = {
  monthly_cap: 15000,
  safety_margin: 0.70, // 70% margin
  user_daily_limit: 20,
  guest_daily_limit: 5,
  spam_throttle_ms: 30000 // 30 seconds
};

let lastCallTimestamp = 0;
let cachedGlobalUsage: { count: number, timestamp: number } | null = null;

/**
 * Registra o uso da API no Firestore para o Painel Admin do DragFire
 */
const logGoogleAPIUsage = (endpoint: string) => {
  try {
    const today = new Date();
    const monthId = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const docRef = doc(db, 'api_usage', monthId);
    
    // Increment global usage
    setDoc(docRef, {
      [endpoint]: increment(1),
      lastUpdated: today.toISOString()
    }, { merge: true }).catch(err => console.debug('Failed to log API usage:', err));

    // Update local cache to be conservative (increment it immediately)
    if (cachedGlobalUsage) {
      cachedGlobalUsage.count += 1;
    }
  } catch (err) {
    // Ignore silent errors for usage tracking
  }
};

/**
 * Unified API Guardian - Checks all limits before allowing a Google Maps call
 */
export const checkAPILimits = async (userId: string | undefined, isGuest: boolean): Promise<{ allowed: boolean, reason?: string }> => {
  const now = Date.now();

  // 1. Anti-Spam Local Throttle (Per Device)
  if (now - lastCallTimestamp < DEFAULT_LIMITS.spam_throttle_ms) {
    return { allowed: false, reason: 'SPAM_THROTTLE' };
  }
  lastCallTimestamp = now;

  try {
    // 2. Fetch Config & Global Usage (Cached for 15 mins to save Firestore Reads)
    const today = new Date();
    const monthId = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const dayId = today.toISOString().split('T')[0];

    if (!cachedGlobalUsage || (now - cachedGlobalUsage.timestamp > 15 * 60 * 1000)) {
      const globalDoc = await getDoc(doc(db, 'api_usage', monthId));
      const data = globalDoc.data() || {};
      const total = Object.values(data).reduce((acc: number, val) => typeof val === 'number' ? acc + val : acc, 0);
      cachedGlobalUsage = { count: total, timestamp: now };
    }

    // 3. Global Safety Margin Check (70%)
    if (cachedGlobalUsage.count >= (DEFAULT_LIMITS.monthly_cap * DEFAULT_LIMITS.safety_margin)) {
      console.warn('CRITICAL: Global API Safety Limit Reached (70% Margin)');
      return { allowed: false, reason: 'GLOBAL_LIMIT' };
    }

    // 4. User Daily Limit Check
    if (isGuest || !userId) {
      // Guest Logic (Local Storage is easiest for guests, or fixed device ID)
      const guestKey = `guest_usage_${dayId}`;
      const currentGuestUsage = parseInt(localStorage.getItem(guestKey) || '0');
      if (currentGuestUsage >= DEFAULT_LIMITS.guest_daily_limit) {
        return { allowed: false, reason: 'GUEST_LIMIT' };
      }
      localStorage.setItem(guestKey, (currentGuestUsage + 1).toString());
    } else {
      // Logged User Logic
      const userUsageRef = doc(db, 'users', userId, 'usage', dayId);
      const userUsageSnap = await getDoc(userUsageRef);
      const usageCount = userUsageSnap.exists() ? (userUsageSnap.data().count || 0) : 0;

      if (usageCount >= DEFAULT_LIMITS.user_daily_limit) {
        return { allowed: false, reason: 'USER_LIMIT' };
      }

      // Record user usage
      await setDoc(userUsageRef, { count: increment(1), lastCall: today.toISOString() }, { merge: true });
    }

    return { allowed: true };
  } catch (err) {
    console.error('Error checking API limits:', err);
    // If database check fails, we allow as fallback but strictly throttled
    return { allowed: true };
  }
};

export interface GooglePlaceResult {
  place_id: string;
  name: string;
  vicinity: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  rating?: number;
  user_ratings_total?: number;
  photos?: {
    photo_reference: string;
  }[];
  opening_hours?: {
    open_now: boolean;
  };
}

declare global {
  interface Window {
    google: any;
  }
}

/**
 * Helper to wait for Google Maps SDK to be available on the window
 */
const waitForGoogleMaps = (timeout = 5000): Promise<void> => {
  return new Promise((resolve) => {
    if (window.google?.maps?.places) {
      resolve();
      return;
    }

    const checkInterval = setInterval(() => {
      if (window.google?.maps?.places) {
        clearInterval(checkInterval);
        clearTimeout(timeoutId);
        resolve();
      }
    }, 200);

    const timeoutId = setTimeout(() => {
      clearInterval(checkInterval);
      console.warn('Google Maps SDK wait timeout');
      resolve(); // Resolve anyway to not block the app
    }, timeout);
  });
};

export interface GoogleAPIResponse {
  results: GooglePlaceResult[];
  status: string;
  error_message?: string;
}

/**
 * Searches for gas stations near a specific location using the Classic Places API via HTTP
 */
export const fetchNearbyStationsHTTP = async (
  lat: number, 
  lng: number, 
  radius = 50000,
  useKeyword = false,
  userId?: string,
  isGuest = false
): Promise<GoogleAPIResponse> => {
  if (!GOOGLE_MAPS_API_KEY) return { results: [], status: 'MISSING_KEY' };

  // SAFETY CHECK
  const guard = await checkAPILimits(userId, isGuest);
  if (!guard.allowed) return { results: [], status: 'LIMIT_ERROR', error_message: guard.reason };

  try {
    const searchParam = useKeyword ? `keyword=posto` : `type=gas_station`;
    const url = `${API_BASE}/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&${searchParam}&key=${GOOGLE_MAPS_API_KEY}`;
    
    const response = await CapacitorHttp.get({ url });
    const data = response.data;
    
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('Google API Error:', data.status, data.error_message);
      return { results: [], status: data.status, error_message: data.error_message };
    }

    logGoogleAPIUsage('places_nearby_search');
    const results = data.results?.map((res: any) => ({
      place_id: res.place_id,
      name: res.name,
      vicinity: res.vicinity || '',
      geometry: {
        location: {
          lat: res.geometry.location.lat,
          lng: res.geometry.location.lng
        }
      },
      rating: res.rating,
      user_ratings_total: res.user_ratings_total,
      photos: res.photos?.map((p: any) => ({ photo_reference: p.photo_reference }))
    })) || [];

    return { results, status: data.status };
  } catch (error: any) {
    console.error('Error in fetchNearbyStationsHTTP:', error);
    return { results: [], status: 'FETCH_ERROR', error_message: error.message };
  }
};

/**
 * Searches for gas stations near a specific location using the NEW Places API (v1) searchNearby.
 */
export const fetchNearbyStationsNew = async (
  lat: number,
  lng: number,
  radius = 50000,
  userId?: string,
  isGuest = false
): Promise<GoogleAPIResponse> => {
  if (!GOOGLE_MAPS_API_KEY) return { results: [], status: 'MISSING_KEY' };

  // SAFETY CHECK
  const guard = await checkAPILimits(userId, isGuest);
  if (!guard.allowed) return { results: [], status: 'LIMIT_ERROR', error_message: guard.reason };

  try {
    const url = `https://places.googleapis.com/v1/places:searchNearby`;
    const response = await CapacitorHttp.post({
      url,
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.photos'
      },
      data: {
        includedTypes: ["gas_station"],
        maxResultCount: 20,
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: radius
          }
        }
      }
    });

    const data = response.data;
    if (data.error) return { results: [], status: data.error.status, error_message: data.error.message };
    if (!data.places || data.places.length === 0) return { results: [], status: 'ZERO_RESULTS' };

    const results = data.places.map((res: any) => ({
      place_id: res.id,
      name: res.displayName?.text || '',
      vicinity: res.formattedAddress || '',
      geometry: { location: { lat: res.location?.latitude, lng: res.location?.longitude } },
      rating: res.rating,
      user_ratings_total: res.userRatingCount,
      photos: res.photos?.map((p: any) => ({ photo_reference: p.name }))
    }));

    logGoogleAPIUsage('places_nearby_search_v1');
    return { results, status: 'OK' };
  } catch (error: any) {
    console.error('Error in fetchNearbyStationsNew:', error);
    return { results: [], status: 'FETCH_ERROR', error_message: error.message };
  }
};

/**
 * Searches for gas stations using the NEW Places API (v1) Text Search.
 */
export const fetchNearbyStationsTextSearch = async (
  queryText: string,
  lat: number,
  lng: number,
  radius = 50000,
  userId?: string,
  isGuest = false
): Promise<GoogleAPIResponse> => {
  if (!GOOGLE_MAPS_API_KEY) return { results: [], status: 'MISSING_KEY' };

  // SAFETY CHECK
  const guard = await checkAPILimits(userId, isGuest);
  if (!guard.allowed) return { results: [], status: 'LIMIT_ERROR', error_message: guard.reason };

  try {
    const url = `https://places.googleapis.com/v1/places:searchText`;
    const response = await CapacitorHttp.post({
      url,
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.photos'
      },
      data: {
        textQuery: queryText,
        locationBias: {
          circle: { center: { latitude: lat, longitude: lng }, radius: radius }
        },
        languageCode: 'pt-BR'
      }
    });

    const data = response.data;
    if (!data.places) return { results: [], status: 'ZERO_RESULTS' };

    const results = data.places.map((res: any) => ({
      place_id: res.id,
      name: res.displayName?.text || '',
      vicinity: res.formattedAddress || '',
      geometry: { location: { lat: res.location?.latitude, lng: res.location?.longitude } },
      rating: res.rating,
      user_ratings_total: res.userRatingCount,
      photos: res.photos?.map((p: any) => ({ photo_reference: p.name }))
    }));

    logGoogleAPIUsage('places_text_search_v1');
    return { results, status: 'OK' };
  } catch (error: any) {
    console.error('Error in fetchNearbyStationsTextSearch:', error);
    return { results: [], status: 'FETCH_ERROR', error_message: error.message };
  }
};

/**
 * Generic search for places using the Places API (v1) Text Search.
 */
export const searchPlacesHTTP = async (
  query: string,
  location: { lat: number, lng: number },
  radius = 50000,
  userId?: string,
  isGuest = false
): Promise<GooglePlaceResult[]> => {
  const response = await fetchNearbyStationsTextSearch(query, location.lat, location.lng, radius, userId, isGuest);
  return response.results;
};

/**
 * Reverse geocodes coordinates to find the city/municipality (Direct HTTP - Mobile Safe)
 */
export const getCityFromCoordinates = async (lat: number, lng: number): Promise<string | null> => {
  if (!GOOGLE_MAPS_API_KEY) return null;

  try {
    const url = `${API_BASE}/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`;
    
    // NUCLEAR OPTION: Jardinópolis Bounding Box
    // Urban/Rural Jardinópolis roughly: Lat [-21.08 to -20.95], Lng [-47.95 to -47.75]
    if (lat <= -20.95 && lat >= -21.08 && lng <= -47.75 && lng >= -47.95) {
      console.log('[CITY] Bounding Box detectou Jardinópolis por coordenadas geográficas.');
      return 'Jardinópolis';
    }

    const response = await CapacitorHttp.get({ url });

    const data = response.data;

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      logGoogleAPIUsage('geocoding_reverse');
      
      const citiesFound: string[] = [];
      for (const result of data.results) {
        const components = result.address_components || [];
        const cityComp = components.find((c: any) => 
          c.types.includes('administrative_area_level_2') || 
          c.types.includes('locality')
        );
        if (cityComp && cityComp.long_name) {
          citiesFound.push(cityComp.long_name);
        }
      }

      if (citiesFound.length > 0) {
        // High Priority Override: If any result mentions Jardinopolis, use it!
        if (citiesFound.some(name => name.includes('Jardinópolis'))) {
          console.log('[CITY] Priority Voting: Jardinópolis detectada.');
          return 'Jardinópolis';
        }
        return citiesFound[0];
      }
      return null;
    }
    return null;
  } catch (error) {
    console.error('Error in direct HTTP reverse geocoding:', error);
    return null;
  }
};

export const getPhotoUrl = (photoName: string, maxWidth = 800) => {
  if (!photoName || !GOOGLE_MAPS_API_KEY) return null;
  return `https://places.googleapis.com/v1/${photoName}/media?key=${GOOGLE_MAPS_API_KEY}&maxWidthPx=${maxWidth}`;
};

export const fetchPlaceDetails = async (placeId: string) => {
  if (!GOOGLE_MAPS_API_KEY || !placeId) return null;
  try {
    const url = `https://places.googleapis.com/v1/places/${placeId}?key=${GOOGLE_MAPS_API_KEY}`;
    const response = await CapacitorHttp.get({
      url,
      headers: { 'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,rating,userRatingCount,reviews,photos,website,regularOpeningHours,formattedPhoneNumber' }
    });
    return response.data || null;
  } catch (error) {
    console.error('Error fetching place details (v1):', error);
    return null;
  }
};

/**
 * Decodes a Google encoded polyline string into an array of [lat, lng] points
 */
export const decodePolyline = (encoded: string): { lat: number, lng: number }[] => {
  const points: { lat: number, lng: number }[] = [];
  let index = 0, len = encoded.length;
  let lat = 0, lng = 0;

  while (index < len) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
};

/**
 * Fetches a route between two points and returns the points of the route
 */
export const fetchRoutePoints = async (
  origin: { lat: number, lng: number },
  destination: string,
  userId?: string,
  isGuest = false
): Promise<{ points: { lat: number, lng: number }[], status: string, routeName?: string | null }> => {
  if (!GOOGLE_MAPS_API_KEY) return { points: [], status: 'MISSING_KEY' };

  // SAFETY CHECK
  const guard = await checkAPILimits(userId, isGuest);
  if (!guard.allowed) return { points: [], status: 'LIMIT_ERROR' };

  try {
    const url = `${API_BASE}/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${encodeURIComponent(destination)}&key=${GOOGLE_MAPS_API_KEY}`;
    const response = await CapacitorHttp.get({ url });
    const data = response.data;

    if (data.status === 'OK' && data.routes && data.routes.length > 0) {
      logGoogleAPIUsage('directions_search');
      
      const route = data.routes[0];
      const routeName = route.summary ? `via ${route.summary}` : null;
      let allPoints: { lat: number, lng: number }[] = [];
      
      // Combine polylines from all steps for maximum precision
      route.legs.forEach((leg: any) => {
        leg.steps.forEach((step: any) => {
          const stepPoints = decodePolyline(step.polyline.points);
          allPoints = [...allPoints, ...stepPoints];
        });
      });
 
      // Simple deduplication of consecutive identical points
      const points = allPoints.filter((p, i, arr) => 
        i === 0 || p.lat !== arr[i-1].lat || p.lng !== arr[i-1].lng
      );

      return { points, status: 'OK', routeName };
    }
    
    return { points: [], status: data.status };
  } catch (error: any) {
    console.error('Error fetching directions:', error);
    return { points: [], status: 'FETCH_ERROR' };
  }
};

/**
 * Fallback to Open-Meteo Elevation API (Free, no key needed)
 */
export const fetchElevationFallback = async (
  points: { lat: number, lng: number }[]
): Promise<{ elevation: number, location: { lat: number, lng: number } }[]> => {
  try {
    const lats = points.map(p => p.lat).join(',');
    const lons = points.map(p => p.lng).join(',');
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lons}`;
    
    const response = await CapacitorHttp.get({ url });
    const data = response.data;

    if (data && data.elevation) {
      return data.elevation.map((elev: number, i: number) => ({
        elevation: elev,
        location: { lat: points[i].lat, lng: points[i].lng }
      }));
    }
    return [];
  } catch (error) {
    console.error('Error in fetchElevationFallback:', error);
    return [];
  }
};

/**
 * Fetches elevation data for multiple coordinates from Google Maps API
 * with automatic fallback to Open-Meteo if Google fails or limit is reached.
 */
export const fetchElevationPoints = async (
  points: { lat: number, lng: number }[],
  userId?: string,
  isGuest = false
): Promise<{ elevation: number, location: { lat: number, lng: number } }[]> => {
  if (points.length === 0) return [];

  // 1. Try Google Maps First (Higher Precision)
  if (GOOGLE_MAPS_API_KEY) {
    const guard = await checkAPILimits(userId, isGuest);
    if (guard.allowed) {
      try {
        const locations = points.map(p => `${p.lat},${p.lng}`).join('|');
        const url = `${API_BASE}/maps/api/elevation/json?locations=${locations}&key=${GOOGLE_MAPS_API_KEY}`;
        
        const response = await CapacitorHttp.get({ url });
        const data = response.data;

        if (data.status === 'OK' && data.results) {
          logGoogleAPIUsage('elevation_search');
          return data.results.map((r: any) => ({
            elevation: r.elevation,
            location: { lat: r.location.lat, lng: r.location.lng }
          }));
        }
      } catch (error) {
        console.warn('Google Elevation failed, trying fallback...', error);
      }
    }
  }

  // 2. Fallback to Open-Meteo (Always available, no limits)
  console.log('Using Open-Meteo fallback for elevation...');
  return fetchElevationFallback(points);
};

