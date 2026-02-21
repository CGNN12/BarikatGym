import * as Location from "expo-location";

// ═══════════════════════════════════════════════════════════
// GYM LOCATION CONFIGURATION
// Change these coordinates to your actual gym location.
// You can find coordinates on Google Maps (right-click → Copy coordinates)
// ═══════════════════════════════════════════════════════════

export const GYM_CONFIG = {
  /** Gym latitude */
  latitude: 39.919417235925124,
  /** Gym longitude */
  longitude: 32.82345489962185,
  /** Maximum allowed distance in meters */
  radiusMeters: 100,
  /** GPS acquisition timeout in milliseconds */
  gpsTimeoutMs: 15000,
  /** Developer mode: set to true to bypass location check during testing */
  devBypass: __DEV__, // Automatically true in dev, false in production
};

// ═══════════════════════════════════════════════════════════
// HAVERSINE FORMULA — Distance between two GPS coordinates
// Returns distance in meters
// ═══════════════════════════════════════════════════════════

export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000; // Earth's radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// ═══════════════════════════════════════════════════════════
// REQUEST LOCATION PERMISSION
// Returns true if permission granted, false otherwise
// ═══════════════════════════════════════════════════════════

export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === "granted";
}

// ═══════════════════════════════════════════════════════════
// CHECK LOCATION PERMISSION STATUS
// ═══════════════════════════════════════════════════════════

export async function checkLocationPermission(): Promise<boolean> {
  const { status } = await Location.getForegroundPermissionsAsync();
  return status === "granted";
}

// ═══════════════════════════════════════════════════════════
// GET CURRENT POSITION (HIGH ACCURACY)
// Returns the user's current coordinates
// ═══════════════════════════════════════════════════════════

export async function getCurrentPosition(): Promise<Location.LocationObject> {
  return await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });
}

// ═══════════════════════════════════════════════════════════
// VERIFY USER IS WITHIN GYM ZONE
// Returns { verified, distance, accuracy }
// ═══════════════════════════════════════════════════════════

export interface LocationVerification {
  verified: boolean;
  distanceMeters: number;
  accuracyMeters: number | null;
  latitude: number;
  longitude: number;
}

export async function verifyGymProximity(): Promise<LocationVerification> {
  const location = await getCurrentPosition();

  const { latitude, longitude } = location.coords;
  const accuracy = location.coords.accuracy ?? null;

  const distance = haversineDistance(
    latitude,
    longitude,
    GYM_CONFIG.latitude,
    GYM_CONFIG.longitude,
  );

  return {
    verified: distance <= GYM_CONFIG.radiusMeters,
    distanceMeters: Math.round(distance * 10) / 10, // 1 decimal
    accuracyMeters: accuracy ? Math.round(accuracy * 10) / 10 : null,
    latitude,
    longitude,
  };
}
