import React, { useState, useEffect } from "react";
import { View, Text, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ScanLine,
  ShieldCheck,
  ShieldX,
  Camera,
  ArrowLeft,
} from "lucide-react-native";
import { COLORS } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import TacticalButton from "@/components/TacticalButton";

export default function ScanScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [scanResult, setScanResult] = useState<"success" | "error" | null>(
    null
  );

  const isCheckIn = mode === "checkin";
  const title = isCheckIn ? "GİRİŞ TARAMI" : "ÇIKIŞ TARAMI";

  const handleBarCodeScanned = async (result: BarcodeScanningResult) => {
    if (scanned || processing) return;
    setScanned(true);
    setProcessing(true);

    try {
      if (!user) throw new Error("Kullanıcı oturumu bulunamadı");

      if (isCheckIn) {
        // Check if user already has an active session
        const { data: existingSession } = await supabase
          .from("gym_logs")
          .select("*")
          .eq("user_id", user.id)
          .eq("status", "inside")
          .maybeSingle();

        if (existingSession) {
          Alert.alert(
            "UYARI",
            "Zaten aktif bir oturumunuz var. Önce çıkış yapmalısınız.",
            [{ text: "ANLAŞILDI" }]
          );
          setScanResult("error");
          setProcessing(false);
          return;
        }

        // Create check-in record
        const { error } = await supabase.from("gym_logs").insert({
          user_id: user.id,
          entry_time: new Date().toISOString(),
          status: "inside",
        });

        if (error) throw error;

        setScanResult("success");
        Alert.alert("GİRİŞ BAŞARILI", "Spor salonuna giriş kaydedildi. İyi antrenmanlar!", [
          {
            text: "TAMAM",
            onPress: () => router.back(),
          },
        ]);
      } else {
        // Find active session and update
        const { data: activeSession } = await supabase
          .from("gym_logs")
          .select("*")
          .eq("user_id", user.id)
          .eq("status", "inside")
          .maybeSingle();

        if (!activeSession) {
          Alert.alert(
            "HATA",
            "Aktif bir oturumunuz bulunamadı.",
            [{ text: "ANLAŞILDI" }]
          );
          setScanResult("error");
          setProcessing(false);
          return;
        }

        const { error } = await supabase
          .from("gym_logs")
          .update({
            exit_time: new Date().toISOString(),
            status: "completed",
          })
          .eq("id", activeSession.id);

        if (error) throw error;

        setScanResult("success");
        Alert.alert("ÇIKIŞ BAŞARILI", "Spor salonundan çıkış kaydedildi. Görüşmek üzere!", [
          {
            text: "TAMAM",
            onPress: () => router.back(),
          },
        ]);
      }
    } catch (error: any) {
      setScanResult("error");
      Alert.alert(
        "İŞLEM BAŞARISIZ",
        error.message || "Bir hata oluştu. Lütfen tekrar deneyin.",
        [{ text: "TEKRAR DENE", onPress: () => setScanned(false) }]
      );
    } finally {
      setProcessing(false);
    }
  };

  // Permission not granted yet
  if (!permission) {
    return (
      <SafeAreaView className="flex-1 bg-tactical-black items-center justify-center">
        <Text className="text-tactical-textMuted text-sm">
          Yükleniyor...
        </Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 bg-tactical-black items-center justify-center px-8">
        <Camera size={48} color={COLORS.textDark} />
        <Text
          className="text-tactical-text text-lg mt-6 text-center"
          style={{ fontFamily: "Inter_600SemiBold" }}
        >
          KAMERA İZNİ GEREKLİ
        </Text>
        <Text className="text-tactical-textMuted text-sm mt-2 text-center">
          QR kod taramak için kamera erişimine izin vermeniz gerekmektedir.
        </Text>
        <View className="w-full mt-8">
          <TacticalButton
            title="KAMERA İZNİ VER"
            onPress={requestPermission}
            icon={<Camera size={18} color={COLORS.text} />}
          />
        </View>
        <View className="w-full mt-3">
          <TacticalButton
            title="GERİ DÖN"
            variant="ghost"
            onPress={() => router.back()}
            icon={<ArrowLeft size={18} color={COLORS.textMuted} />}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-tactical-black">
      {/* Header */}
      <View className="px-6 py-4 flex-row items-center justify-between">
        <TacticalButton
          title="GERİ"
          variant="ghost"
          fullWidth={false}
          onPress={() => router.back()}
          icon={<ArrowLeft size={16} color={COLORS.textMuted} />}
        />
        <View className="flex-row items-center">
          <ScanLine
            size={16}
            color={isCheckIn ? COLORS.green : COLORS.red}
          />
          <Text
            className="text-tactical-text text-xs tracking-widest ml-2 uppercase"
            style={{ fontFamily: "Inter_700Bold" }}
          >
            {title}
          </Text>
        </View>
      </View>

      {/* Camera View */}
      <View className="flex-1 mx-6 mb-6 rounded-sm overflow-hidden border border-tactical-border">
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ["qr"],
          }}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        >
          {/* Scan Overlay */}
          <View className="flex-1 items-center justify-center">
            {/* Scan frame */}
            <View className="w-64 h-64 items-center justify-center">
              {/* Corner indicators */}
              <View className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-tactical-green" />
              <View className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-tactical-green" />
              <View className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-tactical-green" />
              <View className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-tactical-green" />

              {/* Result icon */}
              {scanResult === "success" && (
                <ShieldCheck size={64} color={COLORS.green} />
              )}
              {scanResult === "error" && (
                <ShieldX size={64} color={COLORS.red} />
              )}
            </View>

            {/* Instructions  */}
            <View className="absolute bottom-12 items-center bg-tactical-black/70 px-6 py-3 rounded-sm">
              <Text className="text-tactical-text text-xs tracking-widest uppercase">
                {processing
                  ? "İŞLENİYOR..."
                  : scanned
                  ? "TARAMA TAMAMLANDI"
                  : "QR KODU KAMERAYA GÖSTERİN"}
              </Text>
            </View>
          </View>
        </CameraView>
      </View>

      {/* Retry Button */}
      {scanned && !processing && (
        <View className="px-6 mb-6">
          <TacticalButton
            title="TEKRAR TARA"
            variant="secondary"
            onPress={() => {
              setScanned(false);
              setScanResult(null);
            }}
            icon={<ScanLine size={18} color={COLORS.textMuted} />}
          />
        </View>
      )}
    </SafeAreaView>
  );
}
