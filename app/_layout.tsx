import "@/global.css";
import React, { useEffect } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator } from "react-native";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_900Black,
} from "@expo-google-fonts/inter";
import * as SplashScreen from "expo-splash-screen";
import { useAuth } from "@/hooks/useAuth";
import { registerBackgroundAutoCheckout } from "@/utils/backgroundTasks";

// Keep splash screen visible while loading
SplashScreen.preventAutoHideAsync();

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, initialized } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!initialized) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!user && !inAuthGroup) {
      // Not logged in and not on auth screen -> redirect to login
      router.replace("/(auth)/login");
    } else if (user && inAuthGroup) {
      // Logged in but on auth screen -> redirect to dashboard
      router.replace("/(tabs)/dashboard");
    }
  }, [user, initialized, segments]);

  if (!initialized) {
    return (
      <View className="flex-1 bg-tactical-black items-center justify-center">
        <ActivityIndicator size="large" color="#4B5320" />
      </View>
    );
  }

  return <>{children}</>;
}

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

  // Register Ghost Protocol background task
  useEffect(() => {
    registerBackgroundAutoCheckout();
  }, []);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <>
      <StatusBar style="light" />
      <AuthGuard>
        <Slot />
      </AuthGuard>
    </>
  );
}
