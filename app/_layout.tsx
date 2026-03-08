import "@/global.css";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { Stack, useRouter, useSegments, useRootNavigationState } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  View,
  Text,
  ActivityIndicator,
  ImageBackground,
  StyleSheet,
  AppState,
  type AppStateStatus,
  TouchableOpacity,
  Platform,
  Animated,
  Easing,
} from "react-native";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_900Black,
} from "@expo-google-fonts/inter";
import { ThemeProvider, DarkTheme } from "@react-navigation/native";
import * as SplashScreen from "expo-splash-screen";
import * as Location from "expo-location";
import * as Linking from "expo-linking";
import { useAuth } from "@/hooks/useAuth";
import { AlertProvider } from "@/components/CustomAlert";
import { supabase } from "@/lib/supabase";

// Keep splash screen visible while loading
SplashScreen.preventAutoHideAsync();

// ═══════════ CUSTOM DARK THEME ═══════════
const BarikatDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: "#121212",
    card: "#1A1A1A",
    text: "#E0E0E0",
    border: "#333333",
    primary: "#4B5320",
    notification: "#4B5320",
  },
};

// ═══════════════════════════════════════════════════════════
// LOCATION GUARD — Konum Kalkanı
// Konum izni verilmeden uygulamanın içine erişimi %100 engeller
// ═══════════════════════════════════════════════════════════

function LocationGuard({ children }: { children: React.ReactNode }) {
  const [permissionStatus, setPermissionStatus] = useState<
    "loading" | "granted" | "denied"
  >("loading");
  const appState = useRef(AppState.currentState);

  // Pulse animation for the shield icon
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.8,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.3,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    glow.start();
    return () => {
      pulse.stop();
      glow.stop();
    };
  }, [pulseAnim, glowAnim]);

  // ─── Check permissions ───
  const checkPermissions = useCallback(async () => {
    try {
      const { status: fgStatus } =
        await Location.getForegroundPermissionsAsync();

      if (fgStatus === "granted") {
        // Foreground OK — arka plan iznini de kontrol et ama engelleyici yapma
        // (arka plan izni opsiyonel, foreground zorunlu)
        setPermissionStatus("granted");
      } else {
        setPermissionStatus("denied");
      }
    } catch (err) {
      console.error("❌ [LOCATION GUARD] Permission check error:", err);
      // Hata durumunda geçişe izin ver — çökmemeli
      setPermissionStatus("granted");
    }
  }, []);

  // ─── Request permissions on mount ───
  useEffect(() => {
    const requestPermissions = async () => {
      try {
        const { status: fgStatus } =
          await Location.requestForegroundPermissionsAsync();

        if (fgStatus === "granted") {
          // Arka plan iznini de iste (opsiyonel — reddederse sadece foreground çalışır)
          try {
            await Location.requestBackgroundPermissionsAsync();
          } catch {
            // Background permission isteme başarısız olabilir (Expo Go gibi)
            console.warn("⚠️ [LOCATION GUARD] Background permission request failed (expected in Expo Go)");
          }
          setPermissionStatus("granted");
        } else {
          setPermissionStatus("denied");
        }
      } catch (err) {
        console.error("❌ [LOCATION GUARD] Permission request error:", err);
        setPermissionStatus("granted"); // Hata durumunda kilitleme
      }
    };

    requestPermissions();
  }, []);

  // ─── AppState listener: kullanıcı ayarlardan dönünce tekrar kontrol ───
  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (nextAppState: AppStateStatus) => {
        // Uygulama arka plandan ön plana geldiğinde izinleri tekrar kontrol et
        if (
          appState.current.match(/inactive|background/) &&
          nextAppState === "active"
        ) {
          console.log("🔄 [LOCATION GUARD] App foreground — re-checking permissions");
          checkPermissions();
        }
        appState.current = nextAppState;
      }
    );

    return () => subscription.remove();
  }, [checkPermissions]);

  // ─── Loading state ───
  if (permissionStatus === "loading") {
    return (
      <View style={locStyles.loadingContainer}>
        <ActivityIndicator size="large" color="#4B5320" />
      </View>
    );
  }

  // ─── DENIED — Full screen block ───
  if (permissionStatus === "denied") {
    return (
      <View style={locStyles.blockContainer}>
        {/* Decorative top lines */}
        <View style={locStyles.topDecor}>
          <View style={locStyles.decorLine} />
          <View style={[locStyles.decorLine, { width: "60%", marginTop: 4 }]} />
          <View style={[locStyles.decorLine, { width: "40%", marginTop: 4 }]} />
        </View>

        {/* Shield Icon with glow */}
        <View style={locStyles.iconSection}>
          <Animated.View
            style={[
              locStyles.iconGlow,
              { opacity: glowAnim, transform: [{ scale: pulseAnim }] },
            ]}
          />
          <Animated.View
            style={[
              locStyles.iconCircle,
              { transform: [{ scale: pulseAnim }] },
            ]}
          >
            <Text style={locStyles.iconEmoji}>📍</Text>
          </Animated.View>
        </View>

        {/* Title */}
        <Text style={locStyles.blockTitle}>KONUM İZNİ{"\n"}ZORUNLUDUR</Text>

        {/* Separator */}
        <View style={locStyles.separator}>
          <View style={locStyles.sepLine} />
          <View style={locStyles.sepDiamond} />
          <View style={locStyles.sepLine} />
        </View>

        {/* Description */}
        <Text style={locStyles.blockDesc}>
          Barikat Gym güvenlik sistemi, konum doğrulaması ile çalışmaktadır.
        </Text>
        <Text style={locStyles.blockDescSub}>
          Uygulamayı kullanabilmek için konum erişim iznini{"\n"}
          vermeniz gerekmektedir.
        </Text>

        {/* Feature list */}
        <View style={locStyles.featureList}>
          <View style={locStyles.featureItem}>
            <View style={locStyles.featureDot} />
            <Text style={locStyles.featureText}>QR giriş/çıkış konum doğrulaması</Text>
          </View>
          <View style={locStyles.featureItem}>
            <View style={locStyles.featureDot} />
            <Text style={locStyles.featureText}>Otomatik salon tespit sistemi</Text>
          </View>
          <View style={locStyles.featureItem}>
            <View style={locStyles.featureDot} />
            <Text style={locStyles.featureText}>Güvenli üye takibi</Text>
          </View>
        </View>

        {/* Buttons */}
        <View style={locStyles.buttonSection}>
          {/* Primary: Open Settings */}
          <TouchableOpacity
            style={locStyles.settingsBtn}
            activeOpacity={0.7}
            onPress={() => {
              if (Platform.OS === "ios") {
                Linking.openSettings();
              } else {
                Linking.openSettings();
              }
            }}
          >
            <Text style={locStyles.settingsBtnText}>⚙️  AYARLARA GİT</Text>
          </TouchableOpacity>

          {/* Secondary: Retry */}
          <TouchableOpacity
            style={locStyles.retryBtn}
            activeOpacity={0.7}
            onPress={async () => {
              const { status } =
                await Location.requestForegroundPermissionsAsync();
              if (status === "granted") {
                try {
                  await Location.requestBackgroundPermissionsAsync();
                } catch {
                  // ignored
                }
                setPermissionStatus("granted");
              }
            }}
          >
            <Text style={locStyles.retryBtnText}>TEKRAR İZİN İSTE</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={locStyles.footer}>
          <View style={locStyles.footerLine} />
          <Text style={locStyles.footerText}>BARİKAT • GÜVENLİK PROTOKOLÜ</Text>
          <View style={locStyles.footerLine} />
        </View>
      </View>
    );
  }

  // ─── GRANTED — normal akış ───
  return <>{children}</>;
}

// ═══════════════════════════════════════════════════════════
// AUTH GUARD — Oturum ve Rol Yönlendirmesi
// ═══════════════════════════════════════════════════════════

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, initialized } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isRoleLoading, setIsRoleLoading] = useState(false);
  const roleCheckedForId = React.useRef<string | null>(null);

  // Step 1: When user session exists, fetch role from DB (once per user)
  useEffect(() => {
    if (!initialized) return;

    // OTURUM YOKSA (No Session) DURUMU
    if (!user) {
      setUserRole(null);
      roleCheckedForId.current = null;
      setIsRoleLoading(false);
      return;
    }

    // Eğer rol zaten bu kullanıcı için çekildiyse tekrar çekme
    if (roleCheckedForId.current === user.id) {
      setIsRoleLoading(false);
      return;
    }

    // Rol çekilecek
    let isMounted = true;
    setIsRoleLoading(true);
    
    // ZORUNLU ZAMAN AŞIMI (FAIL-SAFE TIMEOUT): 3 Saniye
    const failSafeTimer = setTimeout(() => {
      if (isMounted) {
        setUserRole("member");
        setIsRoleLoading(false);
        roleCheckedForId.current = user?.id || null;
      }
    }, 3000);

    const fetchRole = async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        if (isMounted) {
          if (error) {
            setUserRole("member");
          } else {
            setUserRole(data?.role ?? "member");
          }
          roleCheckedForId.current = user.id;
        }
      } catch (err: any) {
        if (isMounted) {
          setUserRole("member");
          roleCheckedForId.current = user.id;
        }
      } finally {
        if (isMounted) {
          clearTimeout(failSafeTimer);
          setIsRoleLoading(false);
        }
      }
    };

    fetchRole();

    return () => {
      isMounted = false;
      clearTimeout(failSafeTimer);
    };
  }, [user, initialized]);

  // Step 2: Once role is resolved, redirect to the correct area
  useEffect(() => {
    if (!navigationState?.key) return;
    if (!initialized || isRoleLoading) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inAdminGroup = segments[0] === "admin";
    const inMemberGroup = segments[0] === "member";

    const timeoutId = setTimeout(() => {
      if (!user) {
        if (!inAuthGroup) router.replace("/(auth)/login");
        return;
      }

      if (userRole === "admin") {
        if (!inAdminGroup) router.replace("/admin");
      } else {
        if (!inMemberGroup) router.replace("/member");
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [user, initialized, isRoleLoading, userRole, segments, navigationState?.key]);

  // Show loading while auth or role is resolving
  if (!initialized || isRoleLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4B5320" />
      </View>
    );
  }

  return <>{children}</>;
}

// ═══════════ ROOT LAYOUT ═══════════
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_900Black,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  // LAYER HIERARCHY:
  // 1. View (#121212)  ← Jet black foundation
  // 2. ImageBackground  ← Detailed deer (bgicon) at ~18% opacity
  // 3. LocationGuard    ← Blocks if no location permission
  // 4. ThemeProvider     ← Forces dark on all React Navigation screens
  // 5. AuthGuard         ← Role-based routing
  // 6. Stack             ← App content
  return (
    <>
      <StatusBar style="light" />
      <View style={styles.blackBase}>
        <ImageBackground
          source={require("@/assets/bgicon.png")}
          style={styles.imageBackground}
          imageStyle={styles.deerImage}
        >
          <LocationGuard>
            <ThemeProvider value={BarikatDarkTheme}>
              <AlertProvider>
                <AuthGuard>
                  <Stack 
                    screenOptions={{ 
                      headerShown: false,
                      contentStyle: { backgroundColor: 'transparent' }
                    }} 
                  />
                </AuthGuard>
              </AlertProvider>
            </ThemeProvider>
          </LocationGuard>
        </ImageBackground>
      </View>
    </>
  );
}

// ═══════════ STYLES ═══════════
const styles = StyleSheet.create({
  blackBase: {
    flex: 1,
    backgroundColor: "#121212",
  },
  imageBackground: {
    flex: 1,
  },
  deerImage: {
    opacity: 0.18,
    resizeMode: "contain",
    tintColor: "#4B5320",
    width: "60%",
    height: "60%",
    alignSelf: "center",
    top: "20%",
    left: "20%",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
});

// ═══════════ LOCATION GUARD STYLES ═══════════
const locStyles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  blockContainer: {
    flex: 1,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },

  // ── Top Decoration ──
  topDecor: {
    alignItems: "center",
    marginBottom: 24,
  },
  decorLine: {
    width: "80%",
    height: 1,
    backgroundColor: "rgba(75,83,32,0.3)",
  },

  // ── Icon ──
  iconSection: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  iconGlow: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "rgba(75,83,32,0.12)",
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(75,83,32,0.15)",
    borderWidth: 2,
    borderColor: "rgba(75,83,32,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconEmoji: {
    fontSize: 42,
  },

  // ── Text ──
  blockTitle: {
    color: "#E0E0E0",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 5,
    textAlign: "center",
    lineHeight: 32,
    marginBottom: 16,
  },

  separator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: "80%",
    marginBottom: 20,
  },
  sepLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#333",
  },
  sepDiamond: {
    width: 8,
    height: 8,
    borderRadius: 1,
    backgroundColor: "#4B5320",
    transform: [{ rotate: "45deg" }],
  },

  blockDesc: {
    color: "#A0A0A0",
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 20,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  blockDescSub: {
    color: "#666",
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 19,
    letterSpacing: 0.3,
    marginBottom: 24,
  },

  // ── Feature List ──
  featureList: {
    width: "100%",
    backgroundColor: "rgba(26,26,26,0.5)",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 6,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 32,
    gap: 10,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  featureDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#4B5320",
  },
  featureText: {
    color: "#888",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
  },

  // ── Buttons ──
  buttonSection: {
    width: "100%",
    gap: 12,
    marginBottom: 32,
  },
  settingsBtn: {
    width: "100%",
    backgroundColor: "rgba(75,83,32,0.65)",
    borderWidth: 1.5,
    borderColor: "#5C6B2A",
    borderRadius: 4,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#4B5320",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  settingsBtnText: {
    color: "#E0E0E0",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 3,
  },
  retryBtn: {
    width: "100%",
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#444",
    borderRadius: 4,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  retryBtnText: {
    color: "#888",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 3,
  },

  // ── Footer ──
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    position: "absolute",
    bottom: Platform.OS === "ios" ? 40 : 24,
    left: 32,
    right: 32,
  },
  footerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#1E1E1E",
  },
  footerText: {
    color: "#2A2A2A",
    fontSize: 8,
    fontWeight: "600",
    letterSpacing: 3,
  },
});
