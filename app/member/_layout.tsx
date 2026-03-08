import { useEffect } from "react";
import { Tabs } from "expo-router";
import { Dumbbell, ScanLine, UserCircle } from "lucide-react-native";
import { COLORS } from "@/constants/theme";
import { View, Platform, StyleSheet } from "react-native";
import { useAuth } from "@/hooks/useAuth";
import { startSneakDetection } from "@/utils/sneakDetection";

export default function TabsLayout() {
  const { user } = useAuth();

  // ═══════════ SNEAK DETECTION — Arka Plan Konum Takibi ═══════════
  useEffect(() => {
    if (!user) return;

    // Arka plan konum takibini başlat (try-catch: Expo Go'da çökmeyi engeller)
    const initSneakDetection = async () => {
      try {
        await startSneakDetection();
      } catch (err) {
        console.warn("⚠️ [KAÇAK GİRİŞ] Başlatılamadı (Expo Go sınırlaması olabilir):", err);
      }
    };

    initSneakDetection();
  }, [user]);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#121212",
          borderTopWidth: 0,
          borderTopColor: "transparent",
          height: Platform.OS === "ios" ? 90 : 70,
          paddingBottom: Platform.OS === "ios" ? 25 : 12,
          paddingTop: 8,
          minHeight: 70,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarBackground: () => (
          <View style={StyleSheet.absoluteFill}>
            <View style={{ flex: 1, backgroundColor: "#121212" }} />
          </View>
        ),
        tabBarActiveTintColor: COLORS.green,
        tabBarInactiveTintColor: COLORS.textDark,
        tabBarLabelStyle: {
          fontSize: 9,
          fontFamily: "Inter_600SemiBold",
          letterSpacing: 2,
          textTransform: "uppercase",
          marginTop: 2,
          marginBottom: Platform.OS === "ios" ? 0 : 4,
        },
        sceneStyle: {
          backgroundColor: "transparent",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "MERKEZ",
          tabBarIcon: ({ color, focused }) => (
            <View
              style={
                focused
                  ? {
                      padding: 6,
                      borderRadius: 4,
                      backgroundColor: "rgba(75,83,32,0.2)",
                    }
                  : { padding: 6 }
              }
            >
              <Dumbbell size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: "TARAMA",
          tabBarIcon: ({ color, focused }) => (
            <View
              style={
                focused
                  ? {
                      padding: 6,
                      borderRadius: 4,
                      backgroundColor: "rgba(75,83,32,0.2)",
                    }
                  : { padding: 6 }
              }
            >
              <ScanLine size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "PROFİL",
          tabBarIcon: ({ color, focused }) => (
            <View
              style={
                focused
                  ? {
                      padding: 6,
                      borderRadius: 4,
                      backgroundColor: "rgba(75,83,32,0.2)",
                    }
                  : { padding: 6 }
              }
            >
              <UserCircle size={22} color={color} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
