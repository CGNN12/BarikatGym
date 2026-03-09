import * as Location from "expo-location";

// ═══════════════════════════════════════════════════════════
// GYM LOCATION CONFIGURATION
// Change these coordinates to your actual gym location.
// You can find coordinates on Google Maps (right-click → Copy coordinates)
// ═══════════════════════════════════════════════════════════

export const GYM_CONFIG = {
  // TODO: CANLIYA ÇIKARKEN BURAYI TEKRAR GERÇEK SPOR SALONU KOORDİNATLARIYLA DEĞİŞTİR
  /** Gym latitude (Barikat Gym) */
  latitude: 39.919396214196894,
  /** Gym longitude (Barikat Gym) */
  longitude: 32.82346193468419,
  /**
   * Maximum allowed distance in meters.
   * UAT STRICT MODE: 100m — merkezden itibaren kesin sınır.
   * Bu değer asla bypass edilmez.
   */
  radiusMeters: 100,
  /** GPS acquisition timeout in milliseconds */
  gpsTimeoutMs: 15000,
};

// ═══════════════════════════════════════════════════════════
// SNEAK-IN DETECTION CONFIGURATION
// Kaçak giriş tespiti için sabitler
// ═══════════════════════════════════════════════════════════

export const SNEAK_DETECTION_CONFIG = {
  /** Geofence radius in meters — tight to filter GPS drift & neighbors */
  radiusMeters: 15,
  /** Minimum dwell time in milliseconds (10 minutes) */
  dwellTimeMs: 10 * 60 * 1000,
  /** Background location update interval in milliseconds */
  locationUpdateIntervalMs: 30 * 1000, // 30 seconds
  /** Distance interval for background updates in meters */
  distanceIntervalMeters: 5,
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
