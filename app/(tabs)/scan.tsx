import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, Alert, Animated, Vibration, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from "expo-camera";
import { useRouter, useFocusEffect } from "expo-router";
import {
  ScanLine,
  ShieldCheck,
  ShieldX,
  ShieldAlert,
  Camera,
  ArrowLeft,
  MapPin,
  Crosshair,
  Radio,
} from "lucide-react-native";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import {
  GYM_CONFIG,
  requestLocationPermission,
  checkLocationPermission,
  verifyGymProximity,
  type LocationVerification,
} from "@/lib/location";
import TacticalButton from "@/components/TacticalButton";

// ═══════════ CONSTANTS ═══════════
const VALID_QR_CODE = "BARİKAT_GYM_ACCESS";

type GpsPhase =
  | "idle"
  | "requesting_permission"
  | "acquiring_signal"
  | "calculating_distance"
  | "verifying_zone"
  | "verified"
  | "denied"
  | "failed"
  | "out_of_zone";

export default function ScanScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [scanResult, setScanResult] = useState<
    "success" | "error" | "invalid" | null
  >(null);
  const [resultMessage, setResultMessage] = useState("");

  // ─── GPS States ───
  const [gpsPhase, setGpsPhase] = useState<GpsPhase>("idle");
  const [locationPermitted, setLocationPermitted] = useState<boolean | null>(
    null
  );
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);

  // ─── GPS Signal Animation ───
  const gpsPulse = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // Check location permission on mount
    checkLocationPermission().then(setLocationPermitted);

    // Start GPS pulse animation
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(gpsPulse, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(gpsPulse, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  // ═══════════ RAPID FIRE FIX: Reset scan state on focus ═══════════
  useFocusEffect(
    useCallback(() => {
      // Reset scan state when screen comes into focus
      setScanned(false);
      setScanResult(null);
      setResultMessage("");
      setGpsPhase("idle");
      setGpsAccuracy(null);

      return () => {
        // Cleanup if needed
      };
    }, [])
  );

  // ═══════════ LOCATION VERIFICATION ═══════════

  const verifyLocation = async (): Promise<LocationVerification | null> => {
    // DEV MODE BYPASS
    if (GYM_CONFIG.devBypass) {
      console.log("📍 DEV MODE: Location check bypassed");
      return {
        verified: true,
        distanceMeters: 0,
        accuracyMeters: 5,
        latitude: GYM_CONFIG.latitude,
        longitude: GYM_CONFIG.longitude,
      };
    }

    // Step 1: Request permission
    setGpsPhase("requesting_permission");
    const hasPermission = await requestLocationPermission();

    if (!hasPermission) {
      setGpsPhase("denied");
      setLocationPermitted(false);
      return null;
    }

    setLocationPermitted(true);

    // Step 2: Acquire GPS signal
    setGpsPhase("acquiring_signal");

    try {
      // Race between timeout and location
      const result = await Promise.race<LocationVerification | "timeout">([
        verifyGymProximity(),
        new Promise<"timeout">((resolve) =>
          setTimeout(() => resolve("timeout"), GYM_CONFIG.gpsTimeoutMs)
        ),
      ]);

      if (result === "timeout") {
        setGpsPhase("failed");
        return null;
      }

      // Step 3: Calculate distance
      setGpsPhase("calculating_distance");
      await new Promise((r) => setTimeout(r, 300)); // Brief visual pause

      setGpsAccuracy(result.accuracyMeters);

      // Step 4: Verify zone
      setGpsPhase("verifying_zone");
      await new Promise((r) => setTimeout(r, 300)); // Brief visual pause

      if (result.verified) {
        setGpsPhase("verified");
      } else {
        setGpsPhase("out_of_zone");
      }

      return result;
    } catch (error) {
      setGpsPhase("failed");
      return null;
    }
  };

  // ═══════════ QR CODE HANDLER ═══════════

  const handleBarCodeScanned = async (result: BarcodeScanningResult) => {
    if (scanned || processing) return;
    setScanned(true);
    setProcessing(true);
    setGpsPhase("idle");

    try {
      const scannedData = result.data?.trim();

      // ─── STEP 1: Validate QR Code ───
      if (scannedData !== VALID_QR_CODE) {
        Vibration.vibrate([0, 100, 50, 100]); // Error pattern
        setScanResult("invalid");
        setResultMessage("Geçersiz QR Kod");
        Alert.alert(
          "⚠ GEÇERSİZ QR KOD",
          "Bu QR kod Barikat Gym'e ait değildir. Lütfen doğru QR kodu tarayınız.",
          [
            {
              text: "TEKRAR TARA",
              onPress: resetScan,
            },
          ]
        );
        setProcessing(false);
        return;
      }

      if (!user) {
        throw new Error("Kullanıcı oturumu bulunamadı.");
      }

      // ─── STEP 2: LOCATION VERIFICATION ───
      const locationResult = await verifyLocation();

      // Handle permission denied
      if (locationResult === null && gpsPhase === "denied") {
        Vibration.vibrate([0, 200, 100, 200]);
        setScanResult("error");
        setResultMessage("Konum İzni Reddedildi");
        Alert.alert(
          "🛡️ KONUM UYARISI",
           "Konum erişimi reddedildi. Bu güvenlik özelliği, salon dışından işlem yapılmasını engeller.\n\nLütfen Ayarlar'dan konum iznini etkinleştirin.",
          [{ text: "ANLAŞILDI", onPress: resetScan }]
        );
        setProcessing(false);
        return;
      }

      // Handle GPS timeout/failure
      if (locationResult === null && gpsPhase === "failed") {
        Vibration.vibrate([0, 200, 100, 200]);
        setScanResult("error");
        setResultMessage("GPS Sinyali Alınamadı");
        Alert.alert(
          "📡 GPS SINYAL HATASI",
          "GPS sinyali alınamadı. Lütfen:\n\n• Konum servislerinin açık olduğundan emin olun\n• Açık alana çıkın\n• Tekrar deneyin",
          [{ text: "TEKRAR DENE", onPress: resetScan }]
        );
        setProcessing(false);
        return;
      }

      // Handle out of zone
      if (locationResult && !locationResult.verified) {
        Vibration.vibrate([0, 300, 100, 300, 100, 300]); // Harsh pattern
        setScanResult("error");
        setResultMessage("Alan Dışı!");
        Alert.alert(
          "🚨 ERİŞİM UYARISI",
           `ALAN DIŞI TESPİT EDİLDİ!\n\nBu işlem için spor salonunda olmanız gerekmektedir.\n\n📍 Mesafe: ${locationResult.distanceMeters.toFixed(1)} metre\n🎯 İzin verilen: ${GYM_CONFIG.radiusMeters} metre\n\nSalon dışından giriş/çıkış işlemi yapılamaz.`,
          [{ text: "ANLAŞILDI", onPress: resetScan, style: "destructive" }]
        );
        setProcessing(false);
        return;
      }

      // ─── STEP 3: LOCATION VERIFIED — Process Check-in/Check-out ───
      Vibration.vibrate(100); // Short success buzz

      const { data: activeSession, error: fetchError } = await supabase
        .from("gym_logs")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "inside")
        .order("entry_time", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        throw new Error("Veritabanı sorgusu başarısız: " + fetchError.message);
      }

      if (!activeSession) {
        // ════════ CHECK-IN ════════
        const { error: insertError } = await supabase.from("gym_logs").insert({
          user_id: user.id,
          entry_time: new Date().toISOString(),
          status: "inside",
        });

        if (insertError) throw new Error("Giriş kaydedilemedi: " + insertError.message);

        Vibration.vibrate([0, 100, 50, 100, 50, 100]); // Triple success
        setScanResult("success");
        setResultMessage("Konum Doğrulandı. Giriş Onaylandı.");
        Alert.alert(
          "✅ GİRİŞ BAŞARILI",
          "Konum doğrulandı. Hoş geldiniz!\n\n🎯 Giriş saatiniz kaydedildi.\n📍 Konum: Onaylandı\n\nİyi antrenmanlar!",
          [{ text: "TAMAM", onPress: () => router.back() }]
        );
      } else {
        // ════════ CHECK-OUT ════════
        const { error: updateError } = await supabase
          .from("gym_logs")
          .update({
            exit_time: new Date().toISOString(),
            status: "completed",
          })
          .eq("id", activeSession.id);

        if (updateError) throw new Error("Çıkış kaydedilemedi: " + updateError.message);

        const entryTime = new Date(activeSession.entry_time);
        const exitTime = new Date();
        const diffMs = exitTime.getTime() - entryTime.getTime();
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        Vibration.vibrate([0, 100, 50, 100, 50, 100]);
        setScanResult("success");
        setResultMessage("Konum Doğrulandı. Çıkış Tamamlandı.");
        Alert.alert(
          "✅ ÇIKIŞ TAMAMLANDI",
          `Konum doğrulandı. Görüşmek üzere!\n\n⏱ Süre: ${hours} saat ${minutes} dakika\n📍 Konum: Onaylandı`,
          [{ text: "TAMAM", onPress: () => router.back() }]
        );
      }
    } catch (error: unknown) {
      Vibration.vibrate([0, 200, 100, 200]);
      setScanResult("error");
      let errorMessage = "Bir hata oluştu.";
      if (error instanceof Error) errorMessage = error.message;
      setResultMessage("İşlem Başarısız");
      Alert.alert("❌ İŞLEM BAŞARISIZ", errorMessage, [
        { text: "TEKRAR DENE", onPress: resetScan },
      ]);
    } finally {
      setProcessing(false);
    }
  };

  const resetScan = () => {
    setScanned(false);
    setScanResult(null);
    setResultMessage("");
    setGpsPhase("idle");
  };

  // ═══════════ GPS STATUS TEXT ═══════════

  const getGpsStatusText = (): string => {
    switch (gpsPhase) {
      case "requesting_permission":
        return "KONUM İZNİ İSTENİYOR...";
      case "acquiring_signal":
        return "KONUM ALINIYOR...";
      case "calculating_distance":
        return "MESAFE HESAPLANIYOR...";
      case "verifying_zone":
        return "BÖLGE DOĞRULANIYOR...";
      case "verified":
        return "KONUM DOĞRULANDI ✓";
      case "denied":
        return "KONUM İZNİ REDDEDİLDİ ✗";
      case "failed":
        return "GPS SİNYALİ ALINAMADI ✗";
       case "out_of_zone":
         return "ALAN DIŞI! ✗";
      default:
        return "";
    }
  };

  const getGpsStatusColor = (): string => {
    switch (gpsPhase) {
      case "verified":
        return "#4B5320";
      case "denied":
      case "failed":
      case "out_of_zone":
        return "#8B0000";
      case "idle":
        return "#555";
      default:
        return "#B8860B"; // Amber for in-progress
    }
  };

  // ═══════════ RENDERS ═══════════

  if (!permission) {
    return (
      <SafeAreaView style={s.centered}>
        <Text style={s.loadingText}>Yükleniyor...</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[s.centered, { paddingHorizontal: 32 }]}>
        <Camera size={48} color="#555" />
        <Text style={s.permTitle}>KAMERA İZNİ GEREKLİ</Text>
        <Text style={s.permBody}>
          QR kod taramak için kamera erişimine izin vermeniz gerekmektedir.
        </Text>
        <View style={{ width: "100%", marginTop: 32 }}>
          <TacticalButton
            title="KAMERA İZNİ VER"
            onPress={requestPermission}
            icon={<Camera size={18} color="#E0E0E0" />}
          />
        </View>
        <View style={{ width: "100%", marginTop: 12 }}>
          <TacticalButton
            title="GERİ DÖN"
            variant="ghost"
            onPress={() => router.back()}
            icon={<ArrowLeft size={18} color="#A0A0A0" />}
          />
        </View>
      </SafeAreaView>
    );
  }

  const renderResultIcon = () => {
    if (scanResult === "success")
      return <ShieldCheck size={64} color="#4B5320" />;
    if (scanResult === "error") return <ShieldX size={64} color="#8B0000" />;
    if (scanResult === "invalid")
      return <ShieldAlert size={64} color="#B8860B" />;
    return null;
  };

  const isGpsActive =
    gpsPhase !== "idle" &&
    gpsPhase !== "verified" &&
    gpsPhase !== "denied" &&
    gpsPhase !== "failed" &&
    gpsPhase !== "out_of_zone";

  return (
    <SafeAreaView style={s.safeArea}>
      {/* ═══ Header ═══ */}
      <View style={s.header}>
        <TacticalButton
          title="GERİ"
          variant="ghost"
          fullWidth={false}
          onPress={() => router.back()}
          icon={<ArrowLeft size={16} color="#A0A0A0" />}
        />
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <ScanLine size={16} color="#4B5320" />
          <Text style={s.headerTitle}>QR TARAMA</Text>
        </View>
      </View>

      {/* ═══ GPS Status Bar ═══ */}
      <View
        style={[
          s.gpsBar,
          {
            borderColor: getGpsStatusColor(),
            backgroundColor:
              gpsPhase === "idle"
                ? "rgba(50,50,50,0.4)"
                : gpsPhase === "verified"
                ? "rgba(75,83,32,0.15)"
                : gpsPhase === "out_of_zone" ||
                  gpsPhase === "denied" ||
                  gpsPhase === "failed"
                ? "rgba(139,0,0,0.15)"
                : "rgba(184,134,11,0.15)",
          },
        ]}
      >
        <View style={s.gpsBarLeft}>
          <Animated.View style={{ opacity: isGpsActive ? gpsPulse : 1 }}>
            {gpsPhase === "idle" ? (
              <MapPin size={14} color="#555" />
            ) : gpsPhase === "verified" ? (
              <Crosshair size={14} color="#4B5320" />
            ) : gpsPhase === "out_of_zone" ||
              gpsPhase === "denied" ||
              gpsPhase === "failed" ? (
              <ShieldX size={14} color="#8B0000" />
            ) : (
              <Radio size={14} color="#B8860B" />
            )}
          </Animated.View>

          <Text style={[s.gpsBarText, { color: getGpsStatusColor() }]}>
            {gpsPhase === "idle"
              ? "KONUM DOĞRULAMASI: BEKLEMEDE"
              : getGpsStatusText()}
          </Text>
        </View>

        {/* GPS Accuracy Indicator */}
        {gpsAccuracy !== null && (
          <View style={s.accuracyBadge}>
            <Text style={s.accuracyText}>±{gpsAccuracy}m</Text>
          </View>
        )}

        {/* Dev bypass indicator */}
        {GYM_CONFIG.devBypass && gpsPhase === "idle" && (
          <View style={s.devBadge}>
            <Text style={s.devBadgeText}>DEV</Text>
          </View>
        )}
      </View>

      {/* ═══ Info Banner ═══ */}
      <View style={s.infoBanner}>
        <MapPin size={12} color="#A0A0A0" />
        <Text style={s.infoText}>
          QR tarama + konum doğrulaması ile güvenli giriş/çıkış
        </Text>
      </View>

      {/* ═══ Camera View ═══ */}
      <View style={s.cameraWrapper}>
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        >
          <View style={s.overlay}>
            {/* Scan frame */}
            <View style={s.scanFrame}>
              <View style={[s.corner, s.cornerTL]} />
              <View style={[s.corner, s.cornerTR]} />
              <View style={[s.corner, s.cornerBL]} />
              <View style={[s.corner, s.cornerBR]} />

              {/* Result icon or GPS loading */}
              {renderResultIcon()}
              {isGpsActive && !scanResult && (
                <View style={s.gpsLoadingWrap}>
                  <Animated.View style={{ opacity: gpsPulse }}>
                    <Crosshair size={48} color="#B8860B" />
                  </Animated.View>
                  <Text style={s.gpsLoadingText}>{getGpsStatusText()}</Text>
                </View>
              )}
            </View>

            {/* Bottom instruction */}
            <View style={s.instructionBox}>
              <Text style={s.instructionText}>
                {processing
                  ? isGpsActive
                    ? getGpsStatusText()
                    : "İŞLENİYOR..."
                  : resultMessage
                  ? resultMessage.toUpperCase()
                  : "QR KODU KAMERAYA GÖSTERİN"}
              </Text>
            </View>
          </View>
        </CameraView>
      </View>

      {/* ═══ Retry Button ═══ */}
      {scanned && !processing && (
        <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
          <TacticalButton
            title="TEKRAR TARA"
            variant="secondary"
            onPress={resetScan}
            icon={<ScanLine size={18} color="#A0A0A0" />}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#121212" },
  centered: {
    flex: 1,
    backgroundColor: "#121212",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: { color: "#A0A0A0", fontSize: 14 },
  permTitle: {
    color: "#E0E0E0",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 24,
    textAlign: "center",
  },
  permBody: {
    color: "#A0A0A0",
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  headerTitle: {
    color: "#E0E0E0",
    fontSize: 12,
    letterSpacing: 3,
    fontWeight: "700",
    marginLeft: 8,
    textTransform: "uppercase",
  },

  // GPS Status Bar
  gpsBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 24,
    marginBottom: 8,
    borderWidth: 1,
    borderRadius: 3,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  gpsBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  gpsBarText: {
    fontSize: 9,
    letterSpacing: 2,
    fontWeight: "700",
    marginLeft: 8,
    textTransform: "uppercase",
  },
  accuracyBadge: {
    backgroundColor: "rgba(75,83,32,0.2)",
    borderWidth: 1,
    borderColor: "rgba(75,83,32,0.4)",
    borderRadius: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  accuracyText: {
    color: "#4B5320",
    fontSize: 9,
    letterSpacing: 1,
    fontWeight: "600",
  },
  devBadge: {
    backgroundColor: "rgba(184,134,11,0.2)",
    borderWidth: 1,
    borderColor: "rgba(184,134,11,0.4)",
    borderRadius: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  devBadgeText: {
    color: "#B8860B",
    fontSize: 9,
    letterSpacing: 2,
    fontWeight: "800",
  },

  // Info Banner
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 24,
    marginBottom: 10,
    backgroundColor: "rgba(75,83,32,0.1)",
    borderWidth: 1,
    borderColor: "rgba(75,83,32,0.2)",
    borderRadius: 3,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  infoText: {
    color: "#777",
    fontSize: 10,
    textAlign: "center",
    letterSpacing: 0.5,
    marginLeft: 6,
  },

  // Camera
  cameraWrapper: {
    flex: 1,
    marginHorizontal: 24,
    marginBottom: 16,
    borderRadius: 3,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#333",
  },
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scanFrame: {
    width: 256,
    height: 256,
    alignItems: "center",
    justifyContent: "center",
  },
  corner: { position: "absolute", width: 32, height: 32 },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderColor: "#4B5320",
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: "#4B5320",
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderColor: "#4B5320",
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: "#4B5320",
  },

  // GPS Loading in scan frame
  gpsLoadingWrap: {
    alignItems: "center",
  },
  gpsLoadingText: {
    color: "#B8860B",
    fontSize: 9,
    letterSpacing: 3,
    marginTop: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },

  // Bottom instruction
  instructionBox: {
    position: "absolute",
    bottom: 48,
    backgroundColor: "rgba(18,18,18,0.8)",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 3,
  },
  instructionText: {
    color: "#E0E0E0",
    fontSize: 10,
    letterSpacing: 3,
    textTransform: "uppercase",
    textAlign: "center",
  },
});
