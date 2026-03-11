import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Clock,
  AlertTriangle,
  Activity,
  Calendar,
} from "lucide-react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MEMBERSHIP_WARNING_DAYS, APP_NAME } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import type { Profile, GymLog, MembershipStatus } from "@/lib/types";
import OccupancyDisplay from "@/components/OccupancyDisplay";
import ActivityChart from "@/components/ActivityChart";
import { calculateMembershipStatus } from "@/utils/dateHelpers";

export default function DashboardScreen() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeCount, setActiveCount] = useState(0);
  const [currentSession, setCurrentSession] = useState<GymLog | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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

  // ═══════════ TASK 1: REALTIME SUBSCRIPTION (GYM LOGS) ═══════════
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

  // ═══════════ REALTIME: PROFILE STATUS SUBSCRIPTION ═══════════
  useEffect(() => {
    if (!user?.id) return;

    const profileSubscription = supabase
      .channel('index_realtime_profile')
      .on(
        'postgres_changes',
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Realtime güncellemesi geldi [INDEX]:', payload.new);
          // Orijinal obje mantığını koru ki Derived State (useMemo) tetiklenebilsin
          setProfile(prev => prev ? { ...prev, ...(payload.new as Profile) } : (payload.new as Profile));
        }
      )
      .subscribe((status, err) => {
        if (err) {
          console.error("Profile realtime subscription error:", err);
        }
      });

    return () => {
      supabase.removeChannel(profileSubscription);
    };
  }, [user?.id]);

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

  const derivedData = useMemo(() => {
    const calculated = calculateMembershipStatus(
      profile?.membership_end,
      profile?.status || "inactive"
    );

    const { status, daysLeft, isExpired, isExpiring } = calculated;

    const warningColor = isExpired ? "#8B0000" : "#B8860B";

    return { status, daysLeft, isExpired, isExpiring, warningColor };
  }, [profile]);

  const { status, daysLeft, isExpired, isExpiring, warningColor } = derivedData;



  return (
    <SafeAreaView style={s.safeArea} edges={['top', 'left', 'right']}>
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
            </View>
          </View>
        </View>

        {/* Greeting */}
        <View style={s.greetingWrap}>
          <Text style={s.greetingText}>
            Hoş Geldin, <Text style={s.greetingName}>{profile?.full_name || "Yükleniyor..."}</Text>
          </Text>

          {/* ═══════════ STATUS BADGE ═══════════ */}
          {profile && (
            <View style={[
              s.statusBadge,
              status === "active" ? s.statusBadgeActive :
              status === "frozen" ? s.statusBadgeFrozen :
              status === "inactive" || status === "pending" ? s.statusBadgeInactive :
              s.statusBadgeExpired,
            ]}>
              <View style={[
                s.statusBadgeDot,
                { backgroundColor:
                  status === "active" ? "#5C6B2A" :
                  status === "frozen" ? "#5DADE2" :
                  status === "inactive" || status === "pending" ? "#808080" :
                  "#C0392B"
                },
              ]} />
              <Text style={[
                s.statusBadgeLabel,
                { color:
                  status === "active" ? "#5C6B2A" :
                  status === "frozen" ? "#5DADE2" :
                  status === "inactive" || status === "pending" ? "#808080" :
                  "#C0392B"
                },
              ]}>
                {status === "active" ? "AKTİF" :
                 status === "frozen" ? "DONDURULMUŞ" :
                 status === "inactive" || status === "pending" ? "ONAY BEKLİYOR" :
                 "SÜRESİ DOLMUŞ"}
              </Text>
            </View>
          )}
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
                    ? "ÜYELİK SONA ERDİ"
                    : "ÜYELİK UYARISI"}
                </Text>
                <Text style={s.warningBody}>
                  {isExpired
                    ? "Üyeliğiniz sona ermiştir. Lütfen yöneticiyle iletişime geçin."
                    : `Üyeliğinizin bitmesine ${daysLeft} gün kaldı.`}
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
                      daysLeft <= 0
                        ? "#8B0000"
                        : daysLeft <= MEMBERSHIP_WARNING_DAYS
                        ? "#B8860B"
                        : "#E0E0E0",
                  },
                ]}
              >
                {profile?.membership_end
                  ? daysLeft > 0
                    ? `${daysLeft}`
                    : "0"
                  : "—"}
              </Text>
              <Text style={s.statSub}>
                {!profile?.membership_end
                  ? "TARİH GİRİLMEDİ"
                  : daysLeft > 0
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
  safeArea: { flex: 1, backgroundColor: "transparent" },
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
  greetingText: {
    color: "#666",
    fontSize: 11,
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  greetingName: {
    color: "#666",
  },

  // ═══════════ STATUS BADGE ═══════════
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 20,
    gap: 6,
  },
  statusBadgeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusBadgeLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 3,
  },
  statusBadgeActive: {
    backgroundColor: "rgba(75,83,32,0.12)",
    borderColor: "rgba(75,83,32,0.4)",
  },
  statusBadgeFrozen: {
    backgroundColor: "rgba(93,173,226,0.1)",
    borderColor: "rgba(93,173,226,0.35)",
  },
  statusBadgeInactive: {
    backgroundColor: "rgba(128,128,128,0.1)",
    borderColor: "rgba(128,128,128,0.3)",
  },
  statusBadgeExpired: {
    backgroundColor: "rgba(139,0,0,0.1)",
    borderColor: "rgba(139,0,0,0.3)",
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
    backgroundColor: "rgba(26,26,26,0.35)",
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



  statsGrid: { flexDirection: "row", gap: 12 },
  statCard: {
    flex: 1,
    backgroundColor: "rgba(26,26,26,0.35)",
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
