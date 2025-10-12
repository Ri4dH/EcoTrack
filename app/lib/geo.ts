/**
 * GPS Tracking Module for EcoTrack
 * Live location tracking with Haversine distance calculation
 */
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

const LOCATION_TASK_NAME = 'background-location-task';
const ACCURACY_THRESHOLD_M = 50; // Drop points with accuracy > 50m
const SPEED_THRESHOLD_MS = 12; // Drop points with speed > 12 m/s
const JITTER_THRESHOLD_M = 3; // Ignore movement < 3m

interface TrackPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy: number;
  speed: number | null;
}

let trackingPoints: TrackPoint[] = [];
let isTracking = false;

/**
 * Haversine distance between two coordinates in meters
 */
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Define the background location task
 */
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any): Promise<void> => {
  if (error) {
    console.error('[GEO] Background task error:', error);
    return;
  }
  if (data) {
    const { locations } = data;
    if (locations && locations.length > 0) {
      const location = locations[0];
      const point: TrackPoint = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: location.timestamp,
        accuracy: location.coords.accuracy || 999,
        speed: location.coords.speed,
      };

      // Filter out low-quality points
      if (point.accuracy > ACCURACY_THRESHOLD_M) {
        console.log('[GEO] Dropped point: accuracy too low', point.accuracy);
        return;
      }

      if (point.speed !== null && point.speed > SPEED_THRESHOLD_MS) {
        console.log('[GEO] Dropped point: speed too high', point.speed);
        return;
      }

      // Filter out jitter
      if (trackingPoints.length > 0) {
        const lastPoint = trackingPoints[trackingPoints.length - 1];
        const distanceFromLast = haversineDistance(
          lastPoint.latitude,
          lastPoint.longitude,
          point.latitude,
          point.longitude
        );

        if (distanceFromLast < JITTER_THRESHOLD_M) {
          console.log('[GEO] Dropped point: jitter < 3m');
          return;
        }
      }

      trackingPoints.push(point);
      console.log('[GEO] Added point:', trackingPoints.length, 'total');
    }
  }
});

/**
 * Request location permissions
 */
export async function requestPermissions(): Promise<boolean> {
  try {
    const { status: foregroundStatus } =
      await Location.requestForegroundPermissionsAsync();

    if (foregroundStatus !== 'granted') {
      console.error('[GEO] Foreground permission denied');
      return false;
    }

    const { status: backgroundStatus } =
      await Location.requestBackgroundPermissionsAsync();

    if (backgroundStatus !== 'granted') {
      console.warn('[GEO] Background permission denied (foreground only)');
      // Still allow tracking, just without background
    }

    console.log('[GEO] Permissions granted');
    return true;
  } catch (error) {
    console.error('[GEO] Permission request failed:', error);
    return false;
  }
}

/**
 * Start GPS tracking
 */
export async function startTracking(): Promise<boolean> {
  try {
    console.log('[GEO] Starting tracking...');

    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      throw new Error('Location permission not granted');
    }

    // Reset points
    trackingPoints = [];
    isTracking = true;

    // Start location updates
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.High,
      timeInterval: 5000, // Update every 5 seconds
      distanceInterval: 3, // Or every 3 meters
      foregroundService: {
        notificationTitle: 'EcoTrack',
        notificationBody: 'Tracking your eco-friendly trip',
      },
    });

    console.log('[GEO] Tracking started');
    return true;
  } catch (error) {
    console.error('[GEO] Failed to start tracking:', error);
    isTracking = false;
    return false;
  }
}

/**
 * Stop GPS tracking
 */
export async function stopTracking(): Promise<void> {
  try {
    console.log('[GEO] Stopping tracking...');

    const hasStarted = await TaskManager.isTaskRegisteredAsync(
      LOCATION_TASK_NAME
    );

    if (hasStarted) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }

    isTracking = false;
    console.log('[GEO] Tracking stopped');
  } catch (error) {
    console.error('[GEO] Failed to stop tracking:', error);
  }
}

/**
 * Calculate total distance from tracked points in meters
 */
export function totalDistanceMeters(): number {
  if (trackingPoints.length < 2) {
    return 0;
  }

  let totalDistance = 0;

  for (let i = 1; i < trackingPoints.length; i++) {
    const prev = trackingPoints[i - 1];
    const curr = trackingPoints[i];

    const distance = haversineDistance(
      prev.latitude,
      prev.longitude,
      curr.latitude,
      curr.longitude
    );

    totalDistance += distance;
  }

  return totalDistance;
}

/**
 * Get total distance in miles
 */
export function totalDistanceMi(): number {
  const meters = totalDistanceMeters();
  const km = meters / 1000;
  return km * 0.621371; // Convert km to miles
}

/**
 * Reset tracking points
 */
export function resetPoints(): void {
  trackingPoints = [];
  console.log('[GEO] Points reset');
}

/**
 * Get current tracking points
 */
export function getPoints(): TrackPoint[] {
  return [...trackingPoints];
}

/**
 * Check if currently tracking
 */
export function getIsTracking(): boolean {
  return isTracking;
}

/**
 * Get point count
 */
export function getPointCount(): number {
  return trackingPoints.length;
}
