import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  LogIn,
  LogOut,
  Clock,
  AlertTriangle,
  Shield,
  Activity,
  Calendar,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { MEMBERSHIP_WARNING_DAYS, APP_NAME } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import type { Profile, GymLog, MembershipStatus } from "@/lib/types";
import OccupancyDisplay from "@/components/OccupancyDisplay";
import TacticalButton from "@/components/TacticalButton";
import DeerLogo from "@/components/DeerLogo";
import ActivityChart from "@/components/ActivityChart";

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

  // ═══════════ DATA FETCHERS ═══════════

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (data) {
      setProfile(data);

      if (data.membership_end) {
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
      } else {
        setMembershipDaysLeft(0);
        setMembershipStatus("active");
      }
    }
  }, [user]);

  const fetchActiveCount = useCallback(async () => {
    const { count } = await supabase
      .from("gym_logs")
      .select("*", { count: "exact", head: true })
      .eq("status", "inside");
    setActiveCount(count ?? 0);
  }, []);

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

  const loadData = useCallback(async () => {
    await Promise.all([
      fetchProfile(),
      fetchActiveCount(),
      fetchCurrentSession(),
    ]);
  }, [fetchProfile, fetchActiveCount, fetchCurrentSession]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // ═══════════ TASK 3: AUTO REFRESH ON FOCUS ═══════════
  // When user navigates back from scan screen, this re-fetches everything
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // ═══════════ TASK 1: REALTIME SUBSCRIPTION ═══════════
  useEffect(() => {
    const subscription = supabase
      .channel("realtime_gym_logs")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "gym_logs",
          filter: "status=eq.inside",
        },
        () => {
          // Someone checked in
          fetchActiveCount();
          fetchCurrentSession();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "gym_logs",
          filter: "status=eq.completed",
        },
        () => {
          // Someone checked out
          fetchActiveCount();
          fetchCurrentSession();
        }
      )
      .subscribe((status, err) => {
        if (err) {
          console.error("Realtime subscription error:", err);
        }
      });

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [fetchActiveCount, fetchCurrentSession]);

  // ═══════════ HELPERS ═══════════

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

  const isExpired = membershipStatus === "expired";
  const isExpiring = membershipStatus === "expiring_soon";
  const warningColor = isExpired ? "#8B0000" : "#B8860B";

  return (
    <SafeAreaView style={s.safeArea}>
      <ScrollView
        style={s.flex}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#4B5320"
            colors={["#4B5320"]}
          />
        }
      >
        {/* ═══════════ HEADER ═══════════ */}
        <View style={s.headerRow}>
          <View>
            <Text style={s.appName}>{APP_NAME}</Text>
            <View style={s.statusRow}>
              <Activity size={10} color="#4B5320" />
              <Text style={s.statusText}>SİSTEM AKTİF</Text>
            </View>
          </View>
          <DeerLogo width={50} height={55} opacity={0.35} />
        </View>

        {/* Greeting */}
        <View style={s.greetingWrap}>
          <Text style={s.greetingLabel}>Hoş Geldin, Sporcu</Text>
          <Text style={s.greetingName}>
            {profile?.full_name || "Yükleniyor..."}
          </Text>
        </View>

        {/* ═══════════ TASK 1: LIVE OCCUPANCY ═══════════ */}
        <View style={s.section}>
          <OccupancyDisplay count={activeCount} />
        </View>

        {/* ═══════════ SALON TRAFİĞİ — YOĞUNLUK ANALİZİ ═══════════ */}
        <View style={s.section}>
          <ActivityChart />
        </View>

        {/* ═══════════ MEMBERSHIP WARNING ═══════════ */}
        {(isExpired || isExpiring) && (
          <View style={s.section}>
            <View
              style={[
                s.warningCard,
                {
                  backgroundColor: isExpired
                    ? "rgba(139,0,0,0.1)"
                    : "rgba(184,134,11,0.1)",
                  borderColor: warningColor,
                },
              ]}
            >
              <AlertTriangle size={20} color={warningColor} />
              <View style={s.warningContent}>
                <Text style={[s.warningTitle, { color: warningColor }]}>
                  {isExpired
                    ? "⚠ ÜYELİK SONA ERDİ"
                    : "⚠ ÜYELİK UYARISI"}
                </Text>
                <Text style={s.warningBody}>
                  {isExpired
                    ? "Üyeliğiniz sona ermiştir. Lütfen yöneticiyle iletişime geçin."
                    : `Üyeliğinizin bitmesine ${membershipDaysLeft} gün kaldı.`}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ═══════════ CURRENT SESSION ═══════════ */}
        {currentSession && (
          <View style={s.section}>
            <View style={s.sessionCard}>
              <View style={s.sessionHeader}>
                <View style={s.greenDot} />
                <Text style={s.sessionTitle}>AKTİF OTURUM</Text>
              </View>
              <View style={s.sessionRow}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Clock size={14} color="#A0A0A0" />
                  <Text style={s.sessionDetail}>
                    Giriş: {formatTime(currentSession.entry_time)}
                  </Text>
                </View>
                <Text style={s.sessionDuration}>
                  {formatDuration(currentSession.entry_time)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ═══════════ ACTION BUTTON ═══════════ */}
        <View style={s.section}>
          <View style={s.sectionDivider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerLabel}>İşlemler</Text>
            <View style={s.dividerLine} />
          </View>

          <TacticalButton
            title={
              currentSession ? "ÇIKIŞ İÇİN QR TARA" : "GİRİŞ İÇİN QR TARA"
            }
            variant={currentSession ? "danger" : "primary"}
            icon={
              currentSession ? (
                <LogOut size={20} color="#E0E0E0" />
              ) : (
                <LogIn size={20} color="#E0E0E0" />
              )
            }
            onPress={() => router.push("/(tabs)/scan")}
          />
        </View>

        {/* ═══════════ TASK 2: QUICK STATS WITH DAYS REMAINING ═══════════ */}
        <View style={s.section}>
          <View style={s.statsGrid}>
            {/* Membership Days Remaining */}
            <View style={s.statCard}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                <Calendar size={12} color="#555" />
                <Text style={[s.statLabel, { marginBottom: 0, marginLeft: 6 }]}>
                  Üyelik
                </Text>
              </View>
              <Text
                style={[
                  s.statValue,
                  {
                    color:
                      membershipDaysLeft <= 0
                        ? "#8B0000"
                        : membershipDaysLeft <= MEMBERSHIP_WARNING_DAYS
                        ? "#B8860B"
                        : "#E0E0E0",
                  },
                ]}
              >
                {profile?.membership_end
                  ? membershipDaysLeft > 0
                    ? `${membershipDaysLeft}`
                    : "0"
                  : "—"}
              </Text>
              <Text style={s.statSub}>
                {!profile?.membership_end
                  ? "TARİH GİRİLMEDİ"
                  : membershipDaysLeft > 0
                  ? "GÜN KALDI"
                  : "SÜRESİ DOLDU"}
              </Text>
            </View>

            {/* Status Card */}
            <View style={s.statCard}>
              <Text style={s.statLabel}>Durum</Text>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                  style={[
                    s.statusDot,
                    {
                      backgroundColor: currentSession ? "#4B5320" : "#555",
                    },
                  ]}
                />
                <Text style={s.statValueSmall}>
                  {currentSession ? "İÇERİDE" : "DIŞARIDA"}
                </Text>
              </View>
              <Text style={s.statSub}>
                {currentSession
                  ? formatDuration(currentSession.entry_time)
                  : "SON OTURUM YOK"}
              </Text>
            </View>
          </View>
        </View>

        {/* ═══════════ FOOTER ═══════════ */}
        <View style={s.footer}>
          <Text style={s.footerText}>BARIKAT'TA HER ŞEY MÜMKÜN</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#121212" },
  flex: { flex: 1 },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  appName: {
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 8,
    color: "#E0E0E0",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  statusText: {
    color: "#4B5320",
    fontSize: 9,
    letterSpacing: 4,
    marginLeft: 6,
  },

  greetingWrap: { paddingHorizontal: 24, marginTop: 16, marginBottom: 20 },
  greetingLabel: {
    color: "#666",
    fontSize: 11,
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  greetingName: {
    color: "#E0E0E0",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 4,
  },

  section: { paddingHorizontal: 24, marginBottom: 16 },

  warningCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 3,
    borderWidth: 1,
    borderLeftWidth: 3,
  },
  warningContent: { marginLeft: 12, flex: 1 },
  warningTitle: {
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  warningBody: { color: "#A0A0A0", fontSize: 12, marginTop: 4 },

  sessionCard: {
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "rgba(75,83,32,0.3)",
    borderRadius: 3,
    padding: 16,
  },
  sessionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  greenDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#4B5320",
    marginRight: 8,
  },
  sessionTitle: {
    color: "#4B5320",
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  sessionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sessionDetail: { color: "#A0A0A0", fontSize: 13, marginLeft: 8 },
  sessionDuration: { color: "#E0E0E0", fontSize: 13, fontWeight: "600" },

  sectionDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#333" },
  dividerLabel: {
    color: "#555",
    fontSize: 10,
    letterSpacing: 3,
    marginHorizontal: 12,
    textTransform: "uppercase",
  },

  statsGrid: { flexDirection: "row", gap: 12 },
  statCard: {
    flex: 1,
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 3,
    padding: 16,
  },
  statLabel: {
    color: "#555",
    fontSize: 9,
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  statValue: { color: "#E0E0E0", fontSize: 22, fontWeight: "700" },
  statValueSmall: { color: "#E0E0E0", fontSize: 14, fontWeight: "600" },
  statSub: {
    color: "#555",
    fontSize: 10,
    letterSpacing: 2,
    marginTop: 4,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },

  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    marginTop: 16,
  },
  footerText: {
    color: "#444",
    fontSize: 8,
    letterSpacing: 3,
    marginLeft: 6,
  },
});
