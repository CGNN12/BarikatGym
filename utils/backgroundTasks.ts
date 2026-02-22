import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import { supabase } from "@/lib/supabase";
import { GYM_CONFIG, haversineDistance } from "@/lib/location";

// ═══════════════════════════════════════════════════════════
// OTOMATIK CIKIS — BACKGROUND AUTO CHECK-OUT
// Time + Distance hybrid control
// Runs periodically in the background to auto-checkout users
// who have been inside for 3+ hours AND are 100m+ from gym
// ═══════════════════════════════════════════════════════════

const AUTO_CHECKOUT_TASK = "auto-checkout-task";
const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
const MAX_DISTANCE_METERS = 100;

// ─── Define the background task ───
TaskManager.defineTask(AUTO_CHECKOUT_TASK, async () => {
  console.log("🔄 [OTOMATIK CIKIS] Background task triggered");

  try {
    // Step 1: Get all active sessions (status = 'inside')
    const { data: activeLogs, error: fetchError } = await supabase
      .from("gym_logs")
      .select("*")
      .eq("status", "inside");

    if (fetchError) {
      console.error("❌ [OTOMATIK CIKIS] DB fetch error:", fetchError.message);
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }

    if (!activeLogs || activeLogs.length === 0) {
      console.log("✅ [OTOMATIK CIKIS] No active sessions found");
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const now = new Date();
    let processedCount = 0;

    for (const log of activeLogs) {
      try {
        // Step 2: Check time threshold (3 hours)
        const entryTime = new Date(log.entry_time);
        const elapsed = now.getTime() - entryTime.getTime();

        if (elapsed < THREE_HOURS_MS) {
          console.log(
            `⏳ [OTOMATIK CIKIS] User ${log.user_id} — only ${Math.round(elapsed / 60000)} min elapsed, skipping`,
          );
          continue;
        }

        // Step 3: Get current location
        let location: Location.LocationObject;
        try {
          location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
        } catch (locError) {
          console.warn(
            `📍 [OTOMATIK CIKIS] Location unavailable for user ${log.user_id}, skipping`,
          );
          continue;
        }

        // Step 4: Calculate distance from gym
        const distance = haversineDistance(
          location.coords.latitude,
          location.coords.longitude,
          GYM_CONFIG.latitude,
          GYM_CONFIG.longitude,
        );

        console.log(
          `📐 [OTOMATIK CIKIS] User ${log.user_id} — Distance: ${distance.toFixed(1)}m, Elapsed: ${Math.round(elapsed / 60000)} min`,
        );

        // Step 5: If distance > 100m, auto-checkout
        if (distance > MAX_DISTANCE_METERS) {
          const { error: updateError } = await supabase
            .from("gym_logs")
            .update({
              exit_time: now.toISOString(),
              status: "completed",
            })
            .eq("id", log.id);

          if (updateError) {
            console.error(
              `❌ [OTOMATIK CIKIS] Failed to auto-checkout user ${log.user_id}:`,
              updateError.message,
            );
          } else {
            processedCount++;
            console.log(
              `✅ [OTOMATIK CIKIS] Auto-checked out user ${log.user_id} — Distance: ${distance.toFixed(1)}m, Duration: ${Math.round(elapsed / 60000)} min`,
            );
          }
        } else {
          console.log(
            `📍 [OTOMATIK CIKIS] User ${log.user_id} still near gym (${distance.toFixed(1)}m), keeping session active`,
          );
        }
      } catch (logError) {
        // Don't crash if one user fails, continue with others
        console.error(
          `❌ [OTOMATIK CIKIS] Error processing user ${log.user_id}:`,
          logError,
        );
        continue;
      }
    }

    console.log(
      `🏁 [OTOMATIK CIKIS] Task completed. Auto-checked out ${processedCount} users.`,
    );

    return processedCount > 0
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    console.error("❌ [OTOMATIK CIKIS] Fatal error:", error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// ─── Register the background task ───
export async function registerBackgroundAutoCheckout(): Promise<void> {
  try {
    // Check if background fetch is available
    const status = await BackgroundFetch.getStatusAsync();

    if (
      status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
      status === BackgroundFetch.BackgroundFetchStatus.Denied
    ) {
      console.warn(
        "⚠️ [OTOMATIK CIKIS] Background fetch is restricted or denied",
      );
      return;
    }

    // Check if already registered
    const isRegistered =
      await TaskManager.isTaskRegisteredAsync(AUTO_CHECKOUT_TASK);
    if (isRegistered) {
      console.log("✅ [OTOMATIK CIKIS] Task already registered");
      return;
    }

    // Register background fetch task
    // Minimum interval: 15 minutes (iOS may throttle)
    await BackgroundFetch.registerTaskAsync(AUTO_CHECKOUT_TASK, {
      minimumInterval: 15 * 60, // 15 minutes in seconds
      stopOnTerminate: false, // Continue after app is terminated (Android)
      startOnBoot: true, // Start on device boot (Android)
    });

    console.log("✅ [OTOMATIK CIKIS] Background task registered successfully");
  } catch (error) {
    console.error("❌ [OTOMATIK CIKIS] Failed to register task:", error);
  }
}

// ─── Unregister (for debugging/cleanup) ───
export async function unregisterBackgroundAutoCheckout(): Promise<void> {
  try {
    const isRegistered =
      await TaskManager.isTaskRegisteredAsync(AUTO_CHECKOUT_TASK);
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(AUTO_CHECKOUT_TASK);
      console.log("🗑️ [OTOMATIK CIKIS] Background task unregistered");
    }
  } catch (error) {
    console.error("❌ [OTOMATIK CIKIS] Failed to unregister task:", error);
  }
}
