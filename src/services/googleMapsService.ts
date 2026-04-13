/**
 * Service to interact with Google Maps APIs
 */

// Vite uses import.meta.env for environment variables
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const IS_DEV = import.meta.env.DEV;
const API_BASE = IS_DEV ? '/google-maps-api' : 'https://maps.googleapis.com';

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

/**
 * Searches for gas stations near a specific location using the NEW Places API (v1)
 */
export const fetchNearbyStations = async (lat: number, lng: number, radius = 5000): Promise<GooglePlaceResult[]> => {
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn('Google Maps API Key missing');
    return [];
  }

  try {
    const url = `https://places.googleapis.com/v1/places:searchNearby`;
    
    // The new API requires a POST request with a FieldMask header
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.photos,places.currentOpeningHours'
      },
      body: JSON.stringify({
        includedTypes: ['gas_station'],
        maxResultCount: 20,
        locationRestriction: {
          circle: {
            center: {
              latitude: lat,
              longitude: lng
            },
            radius: radius
          }
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Google Places API Error:', errorData);
      throw new Error('Network response was not ok');
    }
    
    const data = await response.json();
    
    if (!data.places) {
      return [];
    }
    
    // Map the new API format to our existing interface for compatibility
    return data.places.map((place: any) => ({
      place_id: place.id,
      name: place.displayName?.text || 'Posto sem nome',
      vicinity: place.formattedAddress,
      geometry: {
        location: {
          lat: place.location.latitude,
          lng: place.location.longitude
        }
      },
      rating: place.rating,
      user_ratings_total: place.userRatingCount,
      photos: place.photos?.map((p: any) => ({
        photo_reference: p.name // In v1, photo name is used for photoreference
      })),
      opening_hours: {
        open_now: place.currentOpeningHours?.openNow ?? false
      }
    }));
  } catch (error) {
    console.error('Error fetching stations from Google (v1):', error);
    return [];
  }
};

/**
 * Gets a photo URL for a given photo reference (New API v1)
 */
export const getPhotoUrl = (photoName: string, maxWidth = 800) => {
  if (!photoName || !GOOGLE_MAPS_API_KEY) return null;
  // In v1, photoReference is actually the resource name: "places/PLACE_ID/photos/PHOTO_ID"
  return `https://places.googleapis.com/v1/${photoName}/media?key=${GOOGLE_MAPS_API_KEY}&maxWidthPx=${maxWidth}`;
};

/**
 * Gets more details about a specific place (New API v1)
 */
export const fetchPlaceDetails = async (placeId: string) => {
  if (!GOOGLE_MAPS_API_KEY || !placeId) return null;

  try {
    const url = `https://places.googleapis.com/v1/places/${placeId}?key=${GOOGLE_MAPS_API_KEY}`;
    const response = await fetch(url, {
      headers: {
        'X-Goog-FieldMask': 'formattedPhoneNumber,internationalPhoneNumber,website,regularOpeningHours,photos'
      }
    });
    const data = await response.json();
    return data || null;
  } catch (error) {
    console.error('Error fetching place details (v1):', error);
    return null;
  }
};

/**
 * Geocodes a string address to lat/lng coordinates
 */
export const geocodeAddress = async (address: string): Promise<{ lat: number, lng: number } | null> => {
  if (!GOOGLE_MAPS_API_KEY || !address) return null;

  try {
    const url = `${API_BASE}/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'OK' && data.results && data.results[0]) {
      return data.results[0].geometry.location;
    }
    
    console.warn(`Geocoding failed for ${address}: ${data.status}`);
    return null;
  } catch (error) {
    console.error('Error geocoding address:', error);
    return null;
  }
};

/**
 * Reverse geocodes coordinates to find the city/municipality
 */
export const getCityFromCoordinates = async (lat: number, lng: number): Promise<string | null> => {
  if (!GOOGLE_MAPS_API_KEY) return null;

  try {
    const url = `${API_BASE}/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      // Find the locality (city) or administrative_area_level_2
      const cityComponent = data.results[0].address_components.find((c: any) => 
        c.types.includes('locality') || c.types.includes('administrative_area_level_2')
      );
      return cityComponent ? cityComponent.long_name : null;
    }
    
    return null;
  } catch (error) {
    console.error('Error in reverse geocoding:', error);
    return null;
  }
};
