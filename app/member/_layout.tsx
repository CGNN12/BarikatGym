import { useEffect, useState, useCallback, useMemo } from "react";
import { Tabs } from "expo-router";
import { Dumbbell, ScanLine, UserCircle } from "lucide-react-native";
import { COLORS } from "@/constants/theme";
import { View, Text, Platform, StyleSheet, AppState } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/useAuth";
import { startSneakDetection } from "@/utils/sneakDetection";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/types";
import { checkLocationPermission, verifyGymProximity } from "@/lib/location";

const CENTER_SIZE = 64;

// ═══════════ RENK TANIMLARI ═══════════
const BTN_COLORS = {
  active: {
    bg: "#4B5320", // Barikat haki/yeşil
    bgFocused: "#5C6B2A", // Biraz daha aydınlık yeşil
    border: "#0E0E0E", // Kenarlık bar'a karışır
    borderWidth: 3,
    shadow: "#4B5320",
    shadowOpacity: 0.5,
    shadowOpacityFocused: 0.7,
    shadowRadius: 10,
    shadowRadiusFocused: 14,
    elevation: 10,
    elevationFocused: 12,
    iconColor: "#FFF",
    iconOpacity: 1,
    innerRingBorder: "rgba(255,255,255,0.12)",
    innerRingBorderFocused: "rgba(255,255,255,0.3)",
    labelColor: "#505050",
    labelColorFocused: "#4B5320",
  },
  passive: {
    bg: "#0E0E0E",            // Alt bar arka planıyla aynı
    bgFocused: "#1A1A1A",     // Focused: hafif açılır
    border: "#1E1E1E",        // Alt bar üst çizgisiyle aynı — bütünleşik
    borderWidth: 1.5,         // İnce çerçeve
    shadow: "#000000",
    shadowOpacity: 0,
    shadowOpacityFocused: 0.1,
    shadowRadius: 0,
    shadowRadiusFocused: 4,
    elevation: 0,
    elevationFocused: 2,
    iconColor: "#FFF",        // Beyaz ikon — sabit
    iconOpacity: 1,
    innerRingBorder: "rgba(255,255,255,0.06)",
    innerRingBorderFocused: "rgba(255,255,255,0.1)",
    labelColor: "#3A3A3A",
    labelColorFocused: "#4A4A4A",
  },
};

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Partial<Profile> | null>(null);
  const [isWithinZone, setIsWithinZone] = useState<boolean>(true);

  // ═══════════ PROFİL STATUS ÇEKME ═══════════
  const fetchStatus = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("status, membership_end")
      .eq("id", user.id)
      .single();

    if (data) {
      setProfile(data);
    }
  }, [user]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // ═══════════ REALTIME — Profil status değişikliğini dinle ═══════════
  useEffect(() => {
    if (!user?.id) return;

    const profileSubscription = supabase
      .channel('layout_realtime_profile')
      .on(
        'postgres_changes',
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Realtime güncellemesi geldi [LAYOUT]:', payload.new);
          // Orijinal obje mantığını koru ki Derived State (useMemo) tetiklenebilsin
          setProfile(prev => prev ? { ...prev, ...(payload.new as Partial<Profile>) } : (payload.new as Partial<Profile>));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profileSubscription);
    };
  }, [user?.id]);

  // ═══════════ DERIVED STATUS ═══════════
  const memberStatus = useMemo(() => {
    if (!profile) return "loading";
    if (profile.status === "inactive" || profile.status === "pending") return "inactive";
    if (profile.status === "frozen") return "frozen";
    if (profile.membership_end) {
      const endDate = new Date(profile.membership_end);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      endDate.setHours(0, 0, 0, 0);
      if (endDate.getTime() < today.getTime()) {
        return "expired";
      }
    }
    return "active";
  }, [profile]);

  // ═══════════ LOKASYON KONTROLÜ (DİNAMİK BUTON İÇİN) ═══════════
  const checkZone = useCallback(async () => {
    try {
      const hasPerm = await checkLocationPermission();
      if (!hasPerm) return; // İzin yoksa sessiz kal, butonu karartma 
      const result = await verifyGymProximity();
      setIsWithinZone(result.verified);
    } catch {
      setIsWithinZone(true);
    }
  }, []);

  useEffect(() => {
    checkZone();
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") checkZone();
    });
    return () => subscription.remove();
  }, [checkZone]);

  // ═══════════ SNEAK DETECTION — Arka Plan Konum Takibi ═══════════
  useEffect(() => {
    if (!user) return;

    const initSneakDetection = async () => {
      try {
        await startSneakDetection();
      } catch (err) {
        console.warn(
          "⚠️ [KAÇAK GİRİŞ] Başlatılamadı (Expo Go sınırlaması olabilir):",
          err,
        );
      }
    };

    initSneakDetection();
  }, [user]);

  // ═══════════ DİNAMİK RENK HESAPLA ═══════════
  const isActive = memberStatus === "active";
  const canScan = isActive && isWithinZone;
  const palette = canScan ? BTN_COLORS.active : BTN_COLORS.passive;

  // Memoize dynamic styles so they don't re-create every render
  const dynamicCenterBtn = useMemo(
    () => ({
      backgroundColor: palette.bg,
      borderColor: palette.border,
      borderWidth: palette.borderWidth,
      shadowColor: palette.shadow,
      shadowOpacity: palette.shadowOpacity,
      shadowRadius: palette.shadowRadius,
      elevation: palette.elevation,
    }),
    [palette],
  );

  const dynamicCenterBtnFocused = useMemo(
    () => ({
      backgroundColor: palette.bgFocused,
      shadowOpacity: palette.shadowOpacityFocused,
      shadowRadius: palette.shadowRadiusFocused,
      elevation: palette.elevationFocused,
    }),
    [palette],
  );

  const dynamicInnerRing = useMemo(
    () => ({
      borderColor: palette.innerRingBorder,
    }),
    [palette],
  );

  const dynamicInnerRingFocused = useMemo(
    () => ({
      borderColor: palette.innerRingBorderFocused,
    }),
    [palette],
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0E0E0E",
          borderTopWidth: 1,
          borderTopColor: "#1E1E1E",
          height: 60 + (insets.bottom > 0 ? insets.bottom : 10),
          paddingBottom: insets.bottom > 0 ? insets.bottom : 10,
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

      {/* ═══════════ ORTA — TARAMA (DİNAMİK BUTON) ═══════════ */}
      <Tabs.Screen
        name="scan"
        options={{
          title: "TARAMA",
          tabBarLabel: ({ focused }) => (
            <Text
              style={[
                styles.centerLabel,
                {
                  color: focused
                    ? palette.labelColorFocused
                    : palette.labelColor,
                },
              ]}
            >
              TARAMA
            </Text>
          ),
          tabBarIcon: ({ focused }) => (
            <View style={styles.centerWrap}>
              <View
                style={[
                  styles.centerBtn,
                  dynamicCenterBtn,
                  focused && dynamicCenterBtnFocused,
                ]}
              >
                <View
                  style={[
                    styles.centerInnerRing,
                    dynamicInnerRing,
                    focused && dynamicInnerRingFocused,
                  ]}
                >
                  <ScanLine
                    size={26}
                    color={palette.iconColor}
                    strokeWidth={2.5}
                    opacity={palette.iconOpacity}
                  />
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
    // Top offset adjusted for dynamic tab bar height
    top: Platform.OS === "ios" ? -26 : -22,
  },
  centerBtn: {
    width: CENTER_SIZE,
    height: CENTER_SIZE,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",

    shadowOffset: { width: 0, height: 4 },
  },
  centerInnerRing: {
    width: CENTER_SIZE - 14,
    height: CENTER_SIZE - 14,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  centerLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2,
  },
});
