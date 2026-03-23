import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { supabase } from "@/lib/supabase";
import {
  GYM_CONFIG,
  SNEAK_DETECTION_CONFIG,
  haversineDistance,
} from "@/lib/location";

// ═══════════════════════════════════════════════════════════
// KAÇAK GİRİŞ TESPİTİ — SNEAK-IN DETECTION
// ═══════════════════════════════════════════════════════════
//
// MANTIK:
// 1. Üye konumunu arka planda periyodik olarak kontrol et
// 2. 15-metre çember içinde olup olmadığını Haversine ile hesapla
// 3. Kesintisiz 10 dakika boyunca çember içinde kalırsa:
//    a) Bugün QR okutmuş mu? (gym_logs tablosu)
//    b) Evetse → hiçbir şey yapma
//    c) Hayırsa → notifications tablosuna uyarı yaz (günde 1 kez)
//
// ═══════════════════════════════════════════════════════════

const SNEAK_DETECTION_TASK = "sneak-detection-task";

// ─── In-memory dwell state (per-session) ───
// Bu değişkenler arka plan task'ı çalıştığı sürece hafızada tutulur
let dwellStartTime: number | null = null;
let alertSentToday: boolean = false;
let lastAlertDate: string | null = null; // YYYY-MM-DD

/** Get today's date string as YYYY-MM-DD in local time */
function getTodayStr(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

/** Calculate distance between device and gym in meters */
function calculateDistance(lat: number, lng: number): number {
  return haversineDistance(lat, lng, GYM_CONFIG.latitude, GYM_CONFIG.longitude);
}

// ═══════════════════════════════════════════════════════════
// BACKGROUND TASK DEFINITION
// TaskManager.defineTask MUST be called at the module top level
// ═══════════════════════════════════════════════════════════

TaskManager.defineTask(SNEAK_DETECTION_TASK, async ({ data, error }) => {
  if (error) {
    console.error("❌ [KAÇAK GİRİŞ] Task error:", error.message);
    return;
  }

  if (!data) {
    console.log("⚠️ [KAÇAK GİRİŞ] No location data received");
    return;
  }

  const { locations } = data as { locations: Location.LocationObject[] };
  if (!locations || locations.length === 0) return;

  const location = locations[locations.length - 1]; // En güncel konum
  const { latitude, longitude } = location.coords;

  // ─── Step 1: Calculate distance from gym ───
  const distance = calculateDistance(latitude, longitude);
  const isInsideGeofence = distance <= SNEAK_DETECTION_CONFIG.radiusMeters;

  console.log(
    `📍 [KAÇAK GİRİŞ] Konum: ${latitude.toFixed(5)}, ${longitude.toFixed(5)} — Mesafe: ${distance.toFixed(1)}m — ${isInsideGeofence ? "ÇEMBER İÇİ" : "ÇEMBER DIŞI"}`,
  );

  // ─── Step 2: Dwell Time mantığı ───
  const now = Date.now();
  const todayStr = getTodayStr();

  // Gün değiştiyse alert flag'ini sıfırla
  if (lastAlertDate !== todayStr) {
    alertSentToday = false;
    lastAlertDate = todayStr;
  }

  // Zaten bugün alert gönderdiyse işlem yapma
  if (alertSentToday) {
    return;
  }

  if (isInsideGeofence) {
    // Çembere yeni giriyorsa timer başlat
    if (dwellStartTime === null) {
      dwellStartTime = now;
      console.log("⏱️ [KAÇAK GİRİŞ] Dwell Timer BAŞLADI");
      return;
    }

    // Čemberin içindeyse geçen süreyi kontrol et
    const elapsed = now - dwellStartTime;
    const elapsedMinutes = Math.round(elapsed / 60000);
    console.log(
      `⏱️ [KAÇAK GİRİŞ] Dwell süre: ${elapsedMinutes} dakika / ${Math.round(SNEAK_DETECTION_CONFIG.dwellTimeMs / 60000)} dakika`,
    );

    if (elapsed >= SNEAK_DETECTION_CONFIG.dwellTimeMs) {
      // ─── Step 3: 10 dakika doldu — QR kontrolü yap ───
      console.log(
        "🔍 [KAÇAK GİRİŞ] 10 dakika doldu! QR okutma kontrolü yapılıyor...",
      );
      await checkQRAndNotify(todayStr);
    }
  } else {
    // Çember dışına çıktıysa timer'ı sıfırla
    if (dwellStartTime !== null) {
      console.log("🔄 [KAÇAK GİRİŞ] Çember dışı — Dwell Timer SIFIRLANDI");
      dwellStartTime = null;
    }
  }
});

// ═══════════════════════════════════════════════════════════
// QR CHECK + NOTIFICATION LOGIC
// ═══════════════════════════════════════════════════════════

async function checkQRAndNotify(todayStr: string): Promise<void> {
  try {
    // ─── Get current user session ───
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      console.warn("⚠️ [KAÇAK GİRİŞ] Oturum bulunamadı, kontrol atlanıyor");
      return;
    }

    const userId = session.user.id;

    // ─── Get user profile for name ───
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .single();

    const userName = profile?.full_name ?? "Bilinmeyen Üye";

    // ─── Check today's QR scan (gym_logs entries) ───
    // Bugünün başlangıcı ve bitişi — yerel saati UTC'ye çevirerek DB ile eşleştir
    // Türkiye UTC+3: yerel gece yarısı = UTC 21:00 (önceki gün)
    const localMidnightStart = new Date(`${todayStr}T00:00:00`); // yerel gece yarısı başı
    const localMidnightEnd = new Date(`${todayStr}T23:59:59.999`); // yerel gün sonu
    const dayStart = localMidnightStart.toISOString();
    const dayEnd = localMidnightEnd.toISOString();

    const { data: todayLogs, error: logsError } = await supabase
      .from("gym_logs")
      .select("id")
      .eq("user_id", userId)
      .gte("entry_time", dayStart)
      .lte("entry_time", dayEnd)
      .limit(1);

    if (logsError) {
      console.error(
        "❌ [KAÇAK GİRİŞ] gym_logs sorgu hatası:",
        logsError.message,
      );
      return;
    }

    // Bugün QR okutmuş → temiz!
    if (todayLogs && todayLogs.length > 0) {
      console.log("✅ [KAÇAK GİRİŞ] Bugün QR okutmuş — temiz");
      dwellStartTime = null; // Reset timer
      alertSentToday = true; // Tekrar kontrol etmeye gerek yok
      return;
    }

    // ─── SPAM KORUMASI: Bugün zaten bildirim gönderildi mi? ───
    const { data: existingNotif } = await supabase
      .from("notifications")
      .select("id")
      .eq("user_id", userId)
      .eq("type", "sneak_alert")
      .gte("created_at", dayStart)
      .lte("created_at", dayEnd)
      .limit(1);

    if (existingNotif && existingNotif.length > 0) {
      console.log(
        "🔇 [KAÇAK GİRİŞ] Bugün zaten bildirim gönderilmiş — spam koruması",
      );
      alertSentToday = true;
      dwellStartTime = null;
      return;
    }

    // ─── QR OKUTMAMIŞ — BİLDİRİM GÖNDER ───
    const message = `⚠️ ${userName} yaklaşık 10 dakikadır salonda görünüyor ancak QR okutmadı!`;

    const { error: insertError } = await supabase.from("notifications").insert({
      user_id: userId,
      message,
      is_read: false,
      type: "sneak_alert",
    });

    if (insertError) {
      console.error(
        "❌ [KAÇAK GİRİŞ] Bildirim yazma hatası:",
        insertError.message,
      );
      return;
    }

    console.log(`🚨 [KAÇAK GİRİŞ] BİLDİRİM GÖNDERİLDİ: ${message}`);
    alertSentToday = true;
    dwellStartTime = null;
  } catch (err) {
    console.error("❌ [KAÇAK GİRİŞ] checkQRAndNotify hatası:", err);
  }
}

// ═══════════════════════════════════════════════════════════
// START SNEAK DETECTION (called from member layout)
// ═══════════════════════════════════════════════════════════

export async function startSneakDetection(): Promise<void> {
  try {
    console.log("🔄 [KAÇAK GİRİŞ] Arka plan konum takibi başlatılıyor...");

    // ─── Step 1: Foreground Permission ───
    const { status: fgStatus } =
      await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== "granted") {
      console.warn("⚠️ [KAÇAK GİRİŞ] Ön plan konum izni reddedildi");
      return;
    }

    // ─── Step 2: Background Permission ───
    const { status: bgStatus } =
      await Location.requestBackgroundPermissionsAsync();
    if (bgStatus !== "granted") {
      console.warn(
        "⚠️ [KAÇAK GİRİŞ] Arka plan konum izni reddedildi — sistem çalışmayacak",
      );
      return;
    }

    // ─── Step 3: Check if already running ───
    const isRegistered =
      await TaskManager.isTaskRegisteredAsync(SNEAK_DETECTION_TASK);
    if (isRegistered) {
      console.log("✅ [KAÇAK GİRİŞ] Task zaten çalışıyor");
      return;
    }

    // ─── Step 4: Start background location updates ───
    await Location.startLocationUpdatesAsync(SNEAK_DETECTION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: SNEAK_DETECTION_CONFIG.locationUpdateIntervalMs,
      distanceInterval: SNEAK_DETECTION_CONFIG.distanceIntervalMeters,
      deferredUpdatesInterval: SNEAK_DETECTION_CONFIG.locationUpdateIntervalMs,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "Barikat Gym",
        notificationBody: "Konum takibi aktif",
        notificationColor: "#4B5320",
      },
    });

    console.log("✅ [KAÇAK GİRİŞ] Arka plan konum takibi başarıyla başlatıldı");
  } catch (err) {
    console.error("❌ [KAÇAK GİRİŞ] Task başlatma hatası:", err);
  }
}

// ═══════════════════════════════════════════════════════════
// STOP SNEAK DETECTION (cleanup)
// ═══════════════════════════════════════════════════════════

export async function stopSneakDetection(): Promise<void> {
  try {
    const isRegistered =
      await TaskManager.isTaskRegisteredAsync(SNEAK_DETECTION_TASK);
    if (isRegistered) {
      await Location.stopLocationUpdatesAsync(SNEAK_DETECTION_TASK);
      console.log("🛑 [KAÇAK GİRİŞ] Arka plan konum takibi durduruldu");
    }
    // Reset state
    dwellStartTime = null;
    alertSentToday = false;
  } catch (err) {
    console.error("❌ [KAÇAK GİRİŞ] Task durdurma hatası:", err);
  }
}
