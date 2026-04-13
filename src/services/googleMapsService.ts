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

declare global {
  interface Window {
    google: any;
  }
}

/**
 * Helper to wait for Google Maps SDK to be available on the window
 */
const waitForGoogleMaps = (timeout = 5000): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps && window.google.maps.places) {
      resolve();
      return;
    }

    const start = Date.now();
    const interval = setInterval(() => {
      if (window.google && window.google.maps && window.google.maps.places) {
        clearInterval(interval);
        resolve();
      } else if (Date.now() - start > timeout) {
        clearInterval(interval);
        reject(new Error('Google Maps SDK timeout'));
      }
    }, 100);
  });
};

/**
 * Searches for gas stations near a specific location using the OFFICIAL JS SDK
 */
export const fetchNearbyStations = async (lat: number, lng: number, radius = 5000): Promise<GooglePlaceResult[]> => {
  try {
    // Wait for SDK to be ready
    await waitForGoogleMaps();

    return new Promise((resolve) => {
      // We need a dummy div element for the PlacesService to work in some environments
      const dummyElement = document.createElement('div');
      const service = new window.google.maps.places.PlacesService(dummyElement);

      const request = {
        location: new window.google.maps.LatLng(lat, lng),
        radius: radius,
        type: ['gas_station']
      };

      service.nearbySearch(request, (results: any[], status: any) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
          // Map SDK results to our GooglePlaceResult interface
          const mappedResults: GooglePlaceResult[] = results.map(res => ({
            place_id: res.place_id,
            name: res.name,
            vicinity: res.vicinity || res.formatted_address || '',
            geometry: {
              location: {
                lat: res.geometry.location.lat(),
                lng: res.geometry.location.lng()
              }
            },
            rating: res.rating,
            user_ratings_total: res.user_ratings_total,
            photos: res.photos?.map((p: any) => ({
              photo_reference: p.getUrl ? p.getUrl() : '' 
            })),
            opening_hours: {
              open_now: res.opening_hours?.isOpen ? res.opening_hours.isOpen() : false
            }
          }));
          resolve(mappedResults);
        } else {
          console.warn('Google Places SDK returned status:', status);
          resolve([]);
        }
      });
    });
  } catch (error) {
    console.error('Error in fetchNearbyStations (SDK):', error);
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
 * Geocodes a string address to lat/lng coordinates (SDK)
 */
export const geocodeAddress = async (address: string): Promise<{ lat: number, lng: number } | null> => {
  try {
    await waitForGoogleMaps();
    
    return new Promise((resolve) => {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ address }, (results: any, status: any) => {
        if (status === 'OK' && results[0]) {
          resolve({
            lat: results[0].geometry.location.lat(),
            lng: results[0].geometry.location.lng()
          });
        } else {
          console.warn('Geocoding failed:', status);
          resolve(null);
        }
      });
    });
  } catch (error) {
    console.error('Error in geocodeAddress (SDK):', error);
    return null;
  }
};

/**
 * Reverse geocodes coordinates to find the city/municipality (SDK)
 */
export const getCityFromCoordinates = async (lat: number, lng: number): Promise<string | null> => {
  try {
    await waitForGoogleMaps();

    return new Promise((resolve) => {
      const geocoder = new window.google.maps.Geocoder();
      const latlng = { lat, lng };
      
      geocoder.geocode({ location: latlng }, (results: any, status: any) => {
        if (status === 'OK' && results[0]) {
          const cityComponent = results[0].address_components.find((c: any) => 
            c.types.includes('locality') || c.types.includes('administrative_area_level_2')
          );
          resolve(cityComponent ? cityComponent.long_name : null);
        } else {
          console.warn('Reverse geocoding failed:', status);
          resolve(null);
        }
      });
    });
  } catch (error) {
    console.error('Error in getCityFromCoordinates (SDK):', error);
    return null;
  }
};
