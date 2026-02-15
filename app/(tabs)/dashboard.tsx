import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  LogIn,
  LogOut,
  Clock,
  AlertTriangle,
  Shield,
  Activity,
  ChevronRight,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { COLORS, MEMBERSHIP_WARNING_DAYS, APP_NAME } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import type { Profile, GymLog, MembershipStatus } from "@/lib/types";
import OccupancyDisplay from "@/components/OccupancyDisplay";
import TacticalButton from "@/components/TacticalButton";
import DeerLogo from "@/components/DeerLogo";

export default function DashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeCount, setActiveCount] = useState(0);
  const [currentSession, setCurrentSession] = useState<GymLog | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [membershipDaysLeft, setMembershipDaysLeft] = useState(0);
  const [membershipStatus, setMembershipStatus] =
    useState<MembershipStatus>("active");

  // Fetch profile data
  const fetchProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (data) {
      setProfile(data);
      // Calculate membership days left
      const endDate = new Date(data.membership_end);
      const today = new Date();
      const diffTime = endDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      setMembershipDaysLeft(diffDays);

      if (diffDays <= 0) {
        setMembershipStatus("expired");
      } else if (diffDays <= MEMBERSHIP_WARNING_DAYS) {
        setMembershipStatus("expiring_soon");
      } else {
        setMembershipStatus("active");
      }
    }
  }, [user]);

  // Fetch active gym count (realtime)
  const fetchActiveCount = useCallback(async () => {
    const { count } = await supabase
      .from("gym_logs")
      .select("*", { count: "exact", head: true })
      .eq("status", "inside");

    setActiveCount(count ?? 0);
  }, []);

  // Fetch current user session
  const fetchCurrentSession = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("gym_logs")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "inside")
      .order("entry_time", { ascending: false })
      .limit(1)
      .maybeSingle();

    setCurrentSession(data);
  }, [user]);

  // Load all data
  const loadData = useCallback(async () => {
    await Promise.all([
      fetchProfile(),
      fetchActiveCount(),
      fetchCurrentSession(),
    ]);
  }, [fetchProfile, fetchActiveCount, fetchCurrentSession]);

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  useEffect(() => {
    loadData();

    // Subscribe to real-time gym_logs changes
    const subscription = supabase
      .channel("gym_logs_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "gym_logs" },
        () => {
          fetchActiveCount();
          fetchCurrentSession();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  // Format duration
  const formatDuration = (entryTime: string) => {
    const entry = new Date(entryTime);
    const now = new Date();
    const diff = now.getTime() - entry.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}s ${minutes}dk`;
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-tactical-black">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.green}
            colors={[COLORS.green]}
          />
        }
      >
        {/* ═══════════ HEADER ═══════════ */}
        <View className="px-6 pt-4">
          {/* Top Bar */}
          <View className="flex-row items-center justify-between mb-4">
            <View>
              <Text
                className="text-xl tracking-[0.25em] text-tactical-text"
                style={{ fontFamily: "Inter_900Black" }}
              >
                {APP_NAME}
              </Text>
              <View className="flex-row items-center mt-0.5">
                <Activity size={10} color={COLORS.green} />
                <Text className="text-tactical-green text-[9px] tracking-widest ml-1.5">
                  SİSTEM AKTİF
                </Text>
              </View>
            </View>
            <DeerLogo width={50} height={55} opacity={0.35} />
          </View>

          {/* Greeting */}
          <View className="mb-6">
            <Text className="text-tactical-textDark text-xs tracking-widest uppercase">
              Hoş Geldin, Operatör
            </Text>
            <Text
              className="text-tactical-text text-lg mt-1"
              style={{ fontFamily: "Inter_600SemiBold" }}
            >
              {profile?.full_name || "Yükleniyor..."}
            </Text>
          </View>
        </View>

        {/* ═══════════ OCCUPANCY DISPLAY ═══════════ */}
        <View className="px-6 mb-6">
          <OccupancyDisplay count={activeCount} />
        </View>

        {/* ═══════════ MEMBERSHIP WARNING ═══════════ */}
        {membershipStatus !== "active" && (
          <View className="px-6 mb-4">
            <View
              className={`flex-row items-center p-4 rounded-sm border ${
                membershipStatus === "expired"
                  ? "bg-tactical-red/10 border-tactical-red"
                  : "bg-tactical-amber/10 border-tactical-amber"
              }`}
              style={{
                borderLeftWidth: 3,
              }}
            >
              <AlertTriangle
                size={20}
                color={
                  membershipStatus === "expired"
                    ? COLORS.red
                    : COLORS.amber
                }
              />
              <View className="ml-3 flex-1">
                <Text
                  className="text-xs tracking-widest uppercase"
                  style={{
                    fontFamily: "Inter_700Bold",
                    color:
                      membershipStatus === "expired"
                        ? COLORS.red
                        : COLORS.amber,
                  }}
                >
                  {membershipStatus === "expired"
                    ? "⚠ ÜYELİK SONA ERDİ"
                    : "⚠ TAKTİK UYARI"}
                </Text>
                <Text className="text-tactical-textMuted text-xs mt-1">
                  {membershipStatus === "expired"
                    ? "Üyeliğiniz sona ermiştir. Lütfen yöneticiyle iletişime geçin."
                    : `Üyeliğinizin bitmesine ${membershipDaysLeft} gün kaldı.`}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ═══════════ CURRENT SESSION ═══════════ */}
        {currentSession && (
          <View className="px-6 mb-4">
            <View className="bg-tactical-darkGray border border-tactical-green/30 rounded-sm p-4">
              <View className="flex-row items-center mb-3">
                <View className="w-2.5 h-2.5 rounded-full bg-tactical-green mr-2" />
                <Text
                  className="text-tactical-green text-xs tracking-widest uppercase"
                  style={{ fontFamily: "Inter_700Bold" }}
                >
                  AKTİF OTURUM
                </Text>
              </View>

              <View className="flex-row justify-between">
                <View className="flex-row items-center">
                  <Clock size={14} color={COLORS.textMuted} />
                  <Text className="text-tactical-textMuted text-sm ml-2">
                    Giriş: {formatTime(currentSession.entry_time)}
                  </Text>
                </View>
                <Text
                  className="text-tactical-text text-sm"
                  style={{ fontFamily: "Inter_600SemiBold" }}
                >
                  {formatDuration(currentSession.entry_time)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ═══════════ ACTION BUTTONS ═══════════ */}
        <View className="px-6 mt-2">
          <View className="flex-row items-center mb-4">
            <View className="flex-1 h-[1px] bg-tactical-border" />
            <Text className="text-tactical-textDark text-[10px] tracking-widest mx-3 uppercase">
              Operasyonlar
            </Text>
            <View className="flex-1 h-[1px] bg-tactical-border" />
          </View>

          {!currentSession ? (
            <TacticalButton
              title="GİRİŞ YAP — QR TARA"
              variant="primary"
              icon={<LogIn size={20} color={COLORS.text} />}
              onPress={() => router.push("/(tabs)/scan?mode=checkin")}
            />
          ) : (
            <TacticalButton
              title="ÇIKIŞ YAP — QR TARA"
              variant="danger"
              icon={<LogOut size={20} color={COLORS.text} />}
              onPress={() => router.push("/(tabs)/scan?mode=checkout")}
            />
          )}
        </View>

        {/* ═══════════ QUICK STATS ═══════════ */}
        <View className="px-6 mt-6">
          <View className="flex-row gap-3">
            {/* Membership Card */}
            <View className="flex-1 bg-tactical-darkGray border border-tactical-border rounded-sm p-4">
              <Text className="text-tactical-textDark text-[9px] tracking-widest uppercase mb-2">
                Üyelik
              </Text>
              <Text
                className="text-tactical-text text-lg"
                style={{ fontFamily: "Inter_700Bold" }}
              >
                {membershipDaysLeft > 0
                  ? `${membershipDaysLeft}`
                  : "—"}
              </Text>
              <Text className="text-tactical-textDark text-[10px] tracking-wider mt-0.5">
                {membershipDaysLeft > 0 ? "GÜN KALDI" : "SÜRESİ DOLDU"}
              </Text>
            </View>

            {/* Status Card */}
            <View className="flex-1 bg-tactical-darkGray border border-tactical-border rounded-sm p-4">
              <Text className="text-tactical-textDark text-[9px] tracking-widest uppercase mb-2">
                Durum
              </Text>
              <View className="flex-row items-center">
                <View
                  className="w-2.5 h-2.5 rounded-full mr-2"
                  style={{
                    backgroundColor: currentSession
                      ? COLORS.green
                      : COLORS.textDark,
                  }}
                />
                <Text
                  className="text-tactical-text text-sm"
                  style={{ fontFamily: "Inter_600SemiBold" }}
                >
                  {currentSession ? "İÇERİDE" : "DIŞARIDA"}
                </Text>
              </View>
              <Text className="text-tactical-textDark text-[10px] tracking-wider mt-1">
                {currentSession
                  ? formatDuration(currentSession.entry_time)
                  : "SON OTURUM YOK"}
              </Text>
            </View>
          </View>
        </View>

        {/* ═══════════ FOOTER ═══════════ */}
        <View className="px-6 mt-8 items-center">
          <View className="flex-row items-center">
            <Shield size={10} color={COLORS.textDark} />
            <Text className="text-tactical-textDark text-[8px] tracking-widest ml-1.5">
              BARIKAT DEFENCE • SECURED
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
