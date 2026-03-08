import "@/global.css";
import React, { useEffect, useState } from "react";
import { Stack, useRouter, useSegments, useRootNavigationState } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  View,
  ActivityIndicator,
  ImageBackground,
  StyleSheet,
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
import { useAuth } from "@/hooks/useAuth";
import { registerBackgroundAutoCheckout } from "@/utils/backgroundTasks";
import { AlertProvider } from "@/components/CustomAlert";
import { supabase } from "@/lib/supabase";

// Keep splash screen visible while loading
SplashScreen.preventAutoHideAsync();

// ═══════════ CUSTOM DARK THEME ═══════════
// Override React Navigation's default white to enforce matte black
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
      setIsRoleLoading(false); // Direkt yüklemeyi durdur
      return;
    }

    // Eğer rol zaten bu kullanıcı için çekildiyse tekrar çekme
    if (roleCheckedForId.current === user.id) {
      setIsRoleLoading(false); // Emniyet sübabı
      return;
    }

    // Rol çekilecek
    let isMounted = true;
    setIsRoleLoading(true);
    
    // ZORUNLU ZAMAN AŞIMI (FAIL-SAFE TIMEOUT): 3 Saniye
    const failSafeTimer = setTimeout(() => {
      if (isMounted) {
        setUserRole("member");
        setIsRoleLoading(false); // Ekran Kilidi AÇILDI
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
            setUserRole("member"); // Hata durumunda varsayılan üye
          } else {
            setUserRole(data?.role ?? "member");
          }
          roleCheckedForId.current = user.id;
        }
      } catch (err: any) {
        if (isMounted) {
          setUserRole("member"); // Hata durumunda varsayılan üye
          roleCheckedForId.current = user.id;
        }
      } finally {
        // TRY-CATCH-FINALLY YAPISI: İşlem bitince yüklemeyi KESİNLİKLE durdur
        if (isMounted) {
          clearTimeout(failSafeTimer); // İşlem başarılı olduysa zaman aşımı bombasını iptal et
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
    // NAVİGASYON HAZIRLIK KONTROLÜ (Kritik!)
    if (!navigationState?.key) return;
    if (!initialized || isRoleLoading) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inAdminGroup = segments[0] === "admin";
    const inMemberGroup = segments[0] === "member";

    // KUSURSUZ VE TEMİZ YÖNLENDİRME (100ms Gecikmeli)
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

  // TIKANIKLIK GİDERİCİ (Balyoz): Arka plan görevlerini tamamen kaldırdık

  if (!fontsLoaded && !fontError) {
    return null;
  }

  // LAYER HIERARCHY:
  // 1. View (#121212)  ← Jet black foundation, NEVER transparent
  // 2. ImageBackground  ← Detailed deer (bgicon) at ~18% opacity, khaki tint HUD
  // 3. ThemeProvider     ← Forces dark on all React Navigation screens
  // 4. Slot             ← App content
  return (
    <>
      <StatusBar style="light" />
      <View style={styles.blackBase}>
        <ImageBackground
          source={require("@/assets/bgicon.png")}
          style={styles.imageBackground}
          imageStyle={styles.deerImage}
        >
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
        </ImageBackground>
      </View>
    </>
  );
}

// ═══════════ ALL INLINE STYLES — NO NATIVEWIND ═══════════
const styles = StyleSheet.create({
  // Layer 1: Black base
  blackBase: {
    flex: 1,
    backgroundColor: "#121212",
  },
  // Layer 2: ImageBackground fills entire screen, NO backgroundColor
  imageBackground: {
    flex: 1,
  },
  // Layer 2 image: Detailed deer (bgicon) — HUD glass effect
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
  // Loading screen
  loadingContainer: {
    flex: 1,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
});
