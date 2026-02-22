import "@/global.css";
import React, { useEffect } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
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
import {
  ThemeProvider,
  DarkTheme,
} from "@react-navigation/native";
import * as SplashScreen from "expo-splash-screen";
import { useAuth } from "@/hooks/useAuth";
import { registerBackgroundAutoCheckout } from "@/utils/backgroundTasks";

// Keep splash screen visible while loading
SplashScreen.preventAutoHideAsync();

// ═══════════ CUSTOM DARK THEME ═══════════
// Override React Navigation's default theme to enforce matte black
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

// ═══════════ AUTH GUARD ═══════════
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, initialized } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!initialized) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!user && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (user && inAuthGroup) {
      router.replace("/(tabs)/dashboard");
    }
  }, [user, initialized, segments]);

  if (!initialized) {
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

  // Register background auto-checkout task
  useEffect(() => {
    registerBackgroundAutoCheckout();
  }, []);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  // STRUCTURE:
  // Layer 1: View with #121212 (absolute black foundation — NEVER transparent)
  // Layer 2: ImageBackground with deer at ~8% opacity (no backgroundColor)
  // Layer 3: ThemeProvider forces dark theme on ALL React Navigation screens
  // Layer 4: App content (Slot)
  return (
    <>
      <StatusBar style="light" />
      <View style={styles.blackBase}>
        <ImageBackground
          source={require("@/assets/logo.png")}
          style={styles.flex}
          imageStyle={styles.deerImage}
        >
          <ThemeProvider value={BarikatDarkTheme}>
            <AuthGuard>
              <Slot />
            </AuthGuard>
          </ThemeProvider>
        </ImageBackground>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  // Layer 1: Jet black foundation — NEVER transparent, NEVER white
  blackBase: {
    flex: 1,
    backgroundColor: "#121212",
  },
  flex: {
    flex: 1,
  },
  // Layer 2: Deer silhouette overlay — subtle, blurred
  deerImage: {
    opacity: 0.08,
    resizeMode: "contain",
    tintColor: "#4B5320",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#121212",
    alignItems: "center",
    justifyContent: "center",
  },
});
