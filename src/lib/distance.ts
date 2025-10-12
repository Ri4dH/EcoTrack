/**
 * Coordinate interface
 */
export interface Coordinate {
  latitude: number;
  longitude: number;
}

/**
 * Calculate the distance between two coordinates using the Haversine formula
 * @param start - Starting coordinate
 * @param end - Ending coordinate
 * @returns Distance in miles
 */
export function haversineDistance(start: Coordinate, end: Coordinate): number {
  const R = 3958.8; // Earth's radius in miles
  const dLat = toRadians(end.latitude - start.latitude);
  const dLon = toRadians(end.longitude - start.longitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(start.latitude)) *
    Math.cos(toRadians(end.latitude)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 100) / 100; // Round to 2 decimal places in miles
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate distance between two points (always local, no external APIs)
 * @param start - Starting coordinate
 * @param end - Ending coordinate
 * @param mode - Travel mode (walking or bicycling) - kept for API compatibility, not used here
 * @returns Distance in miles
 */
export async function calculateDistance(
  start: Coordinate,
  end: Coordinate,
  mode: "walking" | "bicycling" = "bicycling"
): Promise<number> {
  return haversineDistance(start, end);
}
