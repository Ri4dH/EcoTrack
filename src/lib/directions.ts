/**
 * Google Directions API helper with Haversine fallback
 */
import { GOOGLE_MAPS_API_KEY } from './config';

export interface RouteResult {
  distance_mi: number;
  polyline: string;
  duration_s?: number;
}

export interface Coordinate {
  latitude: number;
  longitude: number;
}

/**
 * Haversine distance between two coordinates in miles
 */
function haversineDistance(from: Coordinate, to: Coordinate): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (from.latitude * Math.PI) / 180;
  const φ2 = (to.latitude * Math.PI) / 180;
  const Δφ = ((to.latitude - from.latitude) * Math.PI) / 180;
  const Δλ = ((to.longitude - from.longitude) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const meters = R * c;
  const km = meters / 1000;
  return km * 0.621371; // Convert to miles
}

/**
 * Fetch route from Google Directions API
 */
export async function fetchRoute(
  origin: Coordinate,
  destination: Coordinate,
  mode: 'walking' | 'bicycling'
): Promise<RouteResult> {
  // If no API key, fall back to Haversine
  if (!GOOGLE_MAPS_API_KEY) {
    console.log('[MAP] No Google API key - using straight-line distance');
    const distance_mi = haversineDistance(origin, destination);
    return {
      distance_mi,
      polyline: '', // No polyline for straight line
    };
  }

  try {
    const originStr = `${origin.latitude},${origin.longitude}`;
    const destStr = `${destination.latitude},${destination.longitude}`;

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originStr}&destination=${destStr}&mode=${mode}&key=${GOOGLE_MAPS_API_KEY}`;

    console.log('[MAP] Fetching route from Google Directions...');
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK') {
      console.error('[MAP] Directions API error:', data.status, data.error_message);
      throw new Error(`Directions API: ${data.status}`);
    }

    if (!data.routes || data.routes.length === 0) {
      throw new Error('No routes found');
    }

    const route = data.routes[0];
    const leg = route.legs[0];

    // Sum all leg distances (usually just one leg)
    let totalMeters = 0;
    for (const legItem of route.legs) {
      totalMeters += legItem.distance.value; // in meters
    }

    console.log('[MAP] Route found:', totalMeters, 'meters');

    // Convert meters to miles
    const km = totalMeters / 1000;
    const distance_mi = km * 0.621371;

    return {
      distance_mi,
      polyline: route.overview_polyline.points,
      duration_s: leg.duration?.value,
    };
  } catch (error) {
    console.error('[MAP] Directions fetch failed, falling back to Haversine:', error);
    // Fallback to straight-line distance
    const distance_mi = haversineDistance(origin, destination);
    return {
      distance_mi,
      polyline: '',
    };
  }
}

/**
 * Decode Google polyline into coordinates
 * Standard polyline decoding algorithm
 */
export function decodePolyline(encoded: string): Coordinate[] {
  if (!encoded) return [];

  const coordinates: Coordinate[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b;
    let shift = 0;
    let result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    coordinates.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }

  return coordinates;
}
