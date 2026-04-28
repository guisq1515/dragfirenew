/**
 * Google Polyline Algorithm implementation for compressing coordinates
 * This significantly reduces the size of maps stored offline.
 */

export const encodePolyline = (points: { lat: number, lng: number }[]): string => {
  let encodedString = '';
  let prevLat = 0;
  let prevLng = 0;

  for (const point of points) {
    const lat = Math.round(point.lat * 1e5);
    const lng = Math.round(point.lng * 1e5);

    const dLat = lat - prevLat;
    const dLng = lng - prevLng;

    prevLat = lat;
    prevLng = lng;

    encodedString += encodeValue(dLat) + encodeValue(dLng);
  }

  return encodedString;
};

const encodeValue = (value: number): string => {
  // Shift value and handle negative sign
  value = value < 0 ? ~(value << 1) : (value << 1);

  let encodedString = '';
  while (value >= 0x20) {
    encodedString += String.fromCharCode((0x20 | (value & 0x1f)) + 63);
    value >>= 5;
  }
  encodedString += String.fromCharCode(value + 63);
  return encodedString;
};

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
