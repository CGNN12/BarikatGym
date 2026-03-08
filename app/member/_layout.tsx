import { useEffect } from "react";
import { Tabs } from "expo-router";
import { Dumbbell, ScanLine, UserCircle } from "lucide-react-native";
import { COLORS } from "@/constants/theme";
import { View, Text, Platform, StyleSheet } from "react-native";
import { useAuth } from "@/hooks/useAuth";
import { startSneakDetection } from "@/utils/sneakDetection";

const TAB_BAR_HEIGHT = Platform.OS === "ios" ? 92 : 72;
const CENTER_SIZE = 64;

export default function TabsLayout() {
  const { user } = useAuth();

  // ═══════════ SNEAK DETECTION — Arka Plan Konum Takibi ═══════════
  useEffect(() => {
    if (!user) return;

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
          backgroundColor: "#0E0E0E",
          borderTopWidth: 1,
          borderTopColor: "#1E1E1E",
          height: TAB_BAR_HEIGHT,
          paddingBottom: Platform.OS === "ios" ? 26 : 10,
          paddingTop: 10,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarActiveTintColor: COLORS.green,
        tabBarInactiveTintColor: "#505050",
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: "700",
          letterSpacing: 2,
          marginTop: 2,
        },
        sceneStyle: {
          backgroundColor: "transparent",
        },
      }}
    >
      {/* ═══════════ SOL — MERKEZ ═══════════ */}
      <Tabs.Screen
        name="index"
        options={{
          title: "MERKEZ",
          tabBarItemStyle: { paddingLeft: 16 },
          tabBarIcon: ({ color, focused }) => (
            <Dumbbell size={22} color={focused ? "#5C6B2A" : color} />
          ),
        }}
      />

      {/* ═══════════ ORTA — TARAMA ═══════════ */}
      <Tabs.Screen
        name="scan"
        options={{
          title: "TARAMA",
          tabBarLabel: ({ focused }) => (
            <Text style={[styles.centerLabel, focused && styles.centerLabelActive]}>TARAMA</Text>
          ),
          tabBarIcon: ({ focused }) => (
            <View style={styles.centerWrap}>
              <View style={[styles.centerBtn, focused && styles.centerBtnActive]}>
                <View style={[styles.centerInnerRing, focused && styles.centerInnerRingActive]}>
                  <ScanLine size={26} color="#FFF" strokeWidth={2.5} />
                </View>
              </View>
            </View>
          ),
        }}
      />

      {/* ═══════════ SAĞ — PROFİL ═══════════ */}
      <Tabs.Screen
        name="profile"
        options={{
          title: "PROFİL",
          tabBarItemStyle: { paddingRight: 16 },
          tabBarIcon: ({ color, focused }) => (
            <UserCircle size={22} color={focused ? "#5C6B2A" : color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  // ═══ Center Button ═══
  centerWrap: {
    alignItems: "center",
    justifyContent: "center",
    top: -26,
  },
  centerBtn: {
    width: CENTER_SIZE,
    height: CENTER_SIZE,
    borderRadius: 16,
    backgroundColor: "#4B5320",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#0E0E0E",
    shadowColor: "#4B5320",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  centerBtnActive: {
    backgroundColor: "#5C6B2A",
    shadowOpacity: 0.7,
    shadowRadius: 14,
    elevation: 12,
  },
  centerInnerRing: {
    width: CENTER_SIZE - 14,
    height: CENTER_SIZE - 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  centerInnerRingActive: {
    borderColor: "rgba(255,255,255,0.3)",
  },
  centerLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2,
    color: "#505050",
  },
  centerLabelActive: {
    color: "#4B5320",
  },
});
