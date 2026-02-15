import React, { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, RefreshControl, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  User,
  Calendar,
  Clock,
  LogOut,
  Shield,
  ChevronRight,
  Activity,
} from "lucide-react-native";
import { COLORS, MEMBERSHIP_WARNING_DAYS } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import type { Profile, GymLog } from "@/lib/types";
import TacticalButton from "@/components/TacticalButton";
import DeerLogo from "@/components/DeerLogo";

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recentLogs, setRecentLogs] = useState<GymLog[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    if (data) setProfile(data);
  }, [user]);

  const fetchRecentLogs = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("gym_logs")
      .select("*")
      .eq("user_id", user.id)
      .order("entry_time", { ascending: false })
      .limit(10);
    if (data) setRecentLogs(data);
  }, [user]);

  const loadData = useCallback(async () => {
    await Promise.all([fetchProfile(), fetchRecentLogs()]);
  }, [fetchProfile, fetchRecentLogs]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, []);

  const handleSignOut = () => {
    Alert.alert(
      "ÇIKIŞ ONAYI",
      "Sistemden çıkış yapmak istediğinize emin misiniz?",
      [
        { text: "İPTAL", style: "cancel" },
        {
          text: "ÇIKIŞ YAP",
          style: "destructive",
          onPress: async () => {
            setLoggingOut(true);
            try {
              await signOut();
            } catch (error: any) {
              Alert.alert("HATA", error.message);
            } finally {
              setLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (entry: string, exit: string | null) => {
    if (!exit) return "Devam ediyor";
    const diff =
      new Date(exit).getTime() - new Date(entry).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}s ${minutes}dk`;
  };

  return (
    <SafeAreaView className="flex-1 bg-tactical-black">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
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
        {/* ═══════════ PROFILE HEADER ═══════════ */}
        <View className="items-center px-6 pt-6 pb-4">
          <DeerLogo width={80} height={90} opacity={0.25} />

          {/* Avatar circle */}
          <View className="w-20 h-20 rounded-full bg-tactical-mediumGray border-2 border-tactical-green items-center justify-center mt-4">
            <User size={36} color={COLORS.textMuted} />
          </View>

          <Text
            className="text-tactical-text text-xl mt-4"
            style={{ fontFamily: "Inter_700Bold" }}
          >
            {profile?.full_name || "Yükleniyor..."}
          </Text>
          <Text className="text-tactical-textDark text-xs tracking-widest mt-1">
            {user?.email}
          </Text>
        </View>

        {/* ═══════════ MEMBERSHIP INFO ═══════════ */}
        <View className="px-6 mt-4">
          <View className="flex-row items-center mb-3">
            <View className="flex-1 h-[1px] bg-tactical-border" />
            <Text className="text-tactical-textDark text-[10px] tracking-widest mx-3 uppercase">
              Üyelik Bilgisi
            </Text>
            <View className="flex-1 h-[1px] bg-tactical-border" />
          </View>

          <View className="bg-tactical-darkGray border border-tactical-border rounded-sm p-4">
            <View className="flex-row justify-between mb-3">
              <View className="flex-row items-center">
                <Calendar size={14} color={COLORS.textMuted} />
                <Text className="text-tactical-textMuted text-xs ml-2 tracking-wider">
                  BAŞLANGIÇ
                </Text>
              </View>
              <Text
                className="text-tactical-text text-sm"
                style={{ fontFamily: "Inter_600SemiBold" }}
              >
                {profile?.membership_start
                  ? formatDate(profile.membership_start)
                  : "—"}
              </Text>
            </View>

            <View className="h-[1px] bg-tactical-border mb-3" />

            <View className="flex-row justify-between">
              <View className="flex-row items-center">
                <Calendar size={14} color={COLORS.textMuted} />
                <Text className="text-tactical-textMuted text-xs ml-2 tracking-wider">
                  BİTİŞ
                </Text>
              </View>
              <Text
                className="text-tactical-text text-sm"
                style={{ fontFamily: "Inter_600SemiBold" }}
              >
                {profile?.membership_end
                  ? formatDate(profile.membership_end)
                  : "—"}
              </Text>
            </View>
          </View>
        </View>

        {/* ═══════════ RECENT ACTIVITY ═══════════ */}
        <View className="px-6 mt-6">
          <View className="flex-row items-center mb-3">
            <View className="flex-1 h-[1px] bg-tactical-border" />
            <Text className="text-tactical-textDark text-[10px] tracking-widest mx-3 uppercase">
              Son Aktiviteler
            </Text>
            <View className="flex-1 h-[1px] bg-tactical-border" />
          </View>

          {recentLogs.length === 0 ? (
            <View className="bg-tactical-darkGray border border-tactical-border rounded-sm p-6 items-center">
              <Activity size={24} color={COLORS.textDark} />
              <Text className="text-tactical-textDark text-xs tracking-wider mt-3">
                HENÜZ AKTİVİTE YOK
              </Text>
            </View>
          ) : (
            recentLogs.map((log, index) => (
              <View
                key={log.id}
                className={`bg-tactical-darkGray border border-tactical-border rounded-sm p-3 mb-2 flex-row items-center justify-between`}
              >
                <View className="flex-row items-center flex-1">
                  <View
                    className="w-2 h-2 rounded-full mr-3"
                    style={{
                      backgroundColor:
                        log.status === "inside" ? COLORS.green : COLORS.textDark,
                    }}
                  />
                  <View>
                    <Text className="text-tactical-textMuted text-[10px] tracking-wider">
                      {formatDate(log.entry_time)}
                    </Text>
                    <Text
                      className="text-tactical-text text-xs mt-0.5"
                      style={{ fontFamily: "Inter_500Medium" }}
                    >
                      {formatTime(log.entry_time)}
                      {log.exit_time && ` → ${formatTime(log.exit_time)}`}
                    </Text>
                  </View>
                </View>
                <Text
                  className="text-xs"
                  style={{
                    fontFamily: "Inter_600SemiBold",
                    color:
                      log.status === "inside" ? COLORS.green : COLORS.textDark,
                  }}
                >
                  {log.status === "inside"
                    ? "İÇERİDE"
                    : formatDuration(log.entry_time, log.exit_time)}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* ═══════════ SIGN OUT ═══════════ */}
        <View className="px-6 mt-8">
          <TacticalButton
            title="SİSTEMDEN ÇIKIŞ"
            variant="danger"
            onPress={handleSignOut}
            loading={loggingOut}
            icon={<LogOut size={18} color={COLORS.text} />}
          />
        </View>

        {/* Footer */}
        <View className="items-center mt-6">
          <View className="flex-row items-center">
            <Shield size={10} color={COLORS.textDark} />
            <Text className="text-tactical-textDark text-[8px] tracking-widest ml-1.5">
              BARIKAT DEFENCE • v1.0.0
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
