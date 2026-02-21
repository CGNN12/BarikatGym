import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Alert,
  TouchableOpacity,
  Platform,
  StyleSheet,
  Modal,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import {
  User,
  Calendar,
  Clock,
  LogOut,
  Shield,
  Activity,
  Save,
  CheckCircle,
  ChevronRight,
  X,
  FileText,
} from "lucide-react-native";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import type { Profile, GymLog } from "@/lib/types";
import TacticalButton from "@/components/TacticalButton";
import DeerLogo from "@/components/DeerLogo";

const PREVIEW_COUNT = 5;

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recentLogs, setRecentLogs] = useState<GymLog[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // ═══════════ FULL HISTORY MODAL ═══════════
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [allLogs, setAllLogs] = useState<GymLog[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);

  // ═══════════ TASK 2: MEMBERSHIP DATE STATES ═══════════
  const [membershipStart, setMembershipStart] = useState<Date>(new Date());
  const [membershipEnd, setMembershipEnd] = useState<Date>(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Default 30 days from now
  );
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

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
      if (data.membership_start) {
        setMembershipStart(new Date(data.membership_start));
      }
      if (data.membership_end) {
        setMembershipEnd(new Date(data.membership_end));
      }
    }
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

  const fetchAllLogs = useCallback(async () => {
    if (!user) return;
    setLoadingAll(true);
    try {
      const { data } = await supabase
        .from("gym_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("entry_time", { ascending: false });
      if (data) setAllLogs(data);
    } catch {
      // silent
    } finally {
      setLoadingAll(false);
    }
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

  // ═══════════ OPEN FULL HISTORY ═══════════

  const openFullHistory = async () => {
    setHistoryModalVisible(true);
    await fetchAllLogs();
  };

  // ═══════════ DATE PICKER HANDLERS ═══════════

  const onStartDateChange = (
    _event: DateTimePickerEvent,
    selectedDate?: Date
  ) => {
    setShowStartPicker(Platform.OS === "ios"); // iOS keeps picker open
    if (selectedDate) {
      setMembershipStart(selectedDate);
      setSaveSuccess(false);
    }
  };

  const onEndDateChange = (
    _event: DateTimePickerEvent,
    selectedDate?: Date
  ) => {
    setShowEndPicker(Platform.OS === "ios");
    if (selectedDate) {
      setMembershipEnd(selectedDate);
      setSaveSuccess(false);
    }
  };

  // ═══════════ SAVE MEMBERSHIP DATES ═══════════

  const handleSaveDates = async () => {
    // Validate: end date must be after start date
    if (membershipEnd <= membershipStart) {
      Alert.alert(
        "HATA",
        "Bitiş tarihi başlangıç tarihinden sonra olmalıdır.",
        [{ text: "ANLAŞILDI" }]
      );
      return;
    }

    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          membership_start: membershipStart.toISOString().split("T")[0],
          membership_end: membershipEnd.toISOString().split("T")[0],
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw error;

      setSaveSuccess(true);
      await fetchProfile();
      Alert.alert(
        "✅ BAŞARILI",
        "Üyelik tarihleri güncellendi.",
        [{ text: "TAMAM" }]
      );

      // Clear success badge after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error: unknown) {
      let msg = "Tarihler kaydedilemedi.";
      if (error instanceof Error) msg = error.message;
      Alert.alert("❌ HATA", msg, [{ text: "ANLAŞILDI" }]);
    } finally {
      setSaving(false);
    }
  };

  // ═══════════ SIGN OUT ═══════════

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
            } catch (error: unknown) {
              let msg = "Çıkış yapılamadı.";
              if (error instanceof Error) msg = error.message;
              Alert.alert("HATA", msg);
            } finally {
              setLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  // ═══════════ FORMATTERS ═══════════

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const formatDateShort = (date: Date) => {
    return date.toLocaleDateString("tr-TR", {
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
    const diff = new Date(exit).getTime() - new Date(entry).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}s ${minutes}dk`;
  };

  const getDaysRemaining = () => {
    if (!profile?.membership_end) return null;
    const end = new Date(profile.membership_end);
    const today = new Date();
    const diff = end.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const daysLeft = getDaysRemaining();

  // ═══════════ LOG CARD RENDERER ═══════════

  const renderLogItem = (log: GymLog) => (
    <View key={log.id} style={s.logItem}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          flex: 1,
        }}
      >
        <View
          style={[
            s.logDot,
            {
              backgroundColor:
                log.status === "inside" ? "#4B5320" : "#555",
            },
          ]}
        />
        <View>
          <Text style={s.logDate}>
            {formatDate(log.entry_time)}
          </Text>
          <Text style={s.logTime}>
            {formatTime(log.entry_time)}
            {log.exit_time && ` → ${formatTime(log.exit_time)}`}
          </Text>
        </View>
      </View>
      <Text
        style={[
          s.logStatus,
          {
            color:
              log.status === "inside" ? "#4B5320" : "#666",
          },
        ]}
      >
        {log.status === "inside"
          ? "İÇERİDE"
          : formatDuration(log.entry_time, log.exit_time)}
      </Text>
    </View>
  );

  // Only show first 5 logs in profile preview
  const previewLogs = recentLogs.slice(0, PREVIEW_COUNT);

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
        {/* ═══════════ PROFILE HEADER ═══════════ */}
        <View style={s.profileHeader}>
          <DeerLogo width={80} height={90} opacity={0.25} />
          <View style={s.avatarCircle}>
            <User size={36} color="#A0A0A0" />
          </View>
          <Text style={s.profileName}>
            {profile?.full_name || "Yükleniyor..."}
          </Text>
          <Text style={s.profileEmail}>{user?.email}</Text>

          {/* Days Remaining Badge */}
          {daysLeft !== null && (
            <View
              style={[
                s.daysBadge,
                {
                  borderColor:
                    daysLeft <= 0
                      ? "#8B0000"
                      : daysLeft <= 7
                      ? "#B8860B"
                      : "#4B5320",
                },
              ]}
            >
              <Text
                style={[
                  s.daysBadgeText,
                  {
                    color:
                      daysLeft <= 0
                        ? "#8B0000"
                        : daysLeft <= 7
                        ? "#B8860B"
                        : "#4B5320",
                  },
                ]}
              >
                {daysLeft > 0
                  ? `${daysLeft} GÜN KALDI`
                  : "ÜYELİK SONA ERDİ"}
              </Text>
            </View>
          )}
        </View>

        {/* ═══════════ TASK 2: MEMBERSHIP DATE SETTING ═══════════ */}
        <View style={s.section}>
          <View style={s.sectionDivider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerLabel}>Üyelik Tarihleri</Text>
            <View style={s.dividerLine} />
          </View>

          <View style={s.membershipCard}>
            {/* Start Date */}
            <View style={s.dateRow}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Calendar size={14} color="#A0A0A0" />
                <Text style={s.dateLabel}>BAŞLANGIÇ TARİHİ</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowStartPicker(true)}
                style={s.dateButton}
                activeOpacity={0.7}
              >
                <Text style={s.dateButtonText}>
                  {formatDateShort(membershipStart)}
                </Text>
              </TouchableOpacity>
            </View>

            {showStartPicker && (
              <DateTimePicker
                value={membershipStart}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={onStartDateChange}
                themeVariant="dark"
              />
            )}

            <View style={s.dateDivider} />

            {/* End Date */}
            <View style={s.dateRow}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Calendar size={14} color="#A0A0A0" />
                <Text style={s.dateLabel}>BİTİŞ TARİHİ</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowEndPicker(true)}
                style={s.dateButton}
                activeOpacity={0.7}
              >
                <Text style={s.dateButtonText}>
                  {formatDateShort(membershipEnd)}
                </Text>
              </TouchableOpacity>
            </View>

            {showEndPicker && (
              <DateTimePicker
                value={membershipEnd}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={onEndDateChange}
                minimumDate={membershipStart}
                themeVariant="dark"
              />
            )}

            {/* Save Button */}
            <View style={{ marginTop: 16 }}>
              <TacticalButton
                title={saveSuccess ? "KAYDEDİLDİ ✓" : "TARİHLERİ KAYDET"}
                variant={saveSuccess ? "secondary" : "primary"}
                onPress={handleSaveDates}
                loading={saving}
                icon={
                  saveSuccess ? (
                    <CheckCircle size={16} color="#4B5320" />
                  ) : (
                    <Save size={16} color="#E0E0E0" />
                  )
                }
              />
            </View>
          </View>
        </View>

        {/* ═══════════ RECENT ACTIVITY (LAST 5 ONLY) ═══════════ */}
        <View style={s.section}>
          <View style={s.sectionDivider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerLabel}>Son Aktiviteler</Text>
            <View style={s.dividerLine} />
          </View>

          {recentLogs.length === 0 ? (
            <View style={s.emptyCard}>
              <Activity size={24} color="#555" />
              <Text style={s.emptyText}>HENÜZ AKTİVİTE YOK</Text>
            </View>
          ) : (
            <>
              {previewLogs.map((log) => renderLogItem(log))}

              {/* "View All" Button */}
              <TouchableOpacity
                onPress={openFullHistory}
                style={s.viewAllButton}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <FileText size={14} color="#4B5320" />
                  <Text style={s.viewAllText}>TÜM GEÇMİŞİ GÖRÜNTÜLE</Text>
                </View>
                <ChevronRight size={16} color="#4B5320" />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* ═══════════ SIGN OUT ═══════════ */}
        <View style={s.section}>
          <TacticalButton
            title="SİSTEMDEN ÇIKIŞ"
            variant="danger"
            onPress={handleSignOut}
            loading={loggingOut}
            icon={<LogOut size={18} color="#E0E0E0" />}
          />
        </View>

        <View style={s.footer}>
          <Shield size={10} color="#444" />
          <Text style={s.footerText}>BARİKAT SAVUNMA • v1.0.0</Text>
        </View>
      </ScrollView>

      {/* ═══════════ FULL HISTORY MODAL ═══════════ */}
      <Modal
        visible={historyModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setHistoryModalVisible(false)}
      >
        <SafeAreaView style={s.modalSafeArea}>
          {/* Modal Header */}
          <View style={s.modalHeader}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <FileText size={16} color="#4B5320" />
              <Text style={s.modalTitle}>OPERASYON KAYITLARI</Text>
            </View>
            <TouchableOpacity
              onPress={() => setHistoryModalVisible(false)}
              style={s.modalCloseButton}
              activeOpacity={0.7}
            >
              <X size={20} color="#A0A0A0" />
            </TouchableOpacity>
          </View>

          <View style={s.modalDivider} />

          {/* Modal Content */}
          {loadingAll ? (
            <View style={s.modalLoadingWrap}>
              <Text style={s.modalLoadingText}>KAYITLAR YÜKLENİYOR...</Text>
            </View>
          ) : allLogs.length === 0 ? (
            <View style={s.modalLoadingWrap}>
              <Activity size={32} color="#555" />
              <Text style={s.modalEmptyText}>KAYIT BULUNAMADI</Text>
            </View>
          ) : (
            <FlatList
              data={allLogs}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => renderLogItem(item)}
              ListHeaderComponent={
                <Text style={s.modalCountText}>
                  Toplam {allLogs.length} kayıt
                </Text>
              }
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#121212" },
  flex: { flex: 1 },

  profileHeader: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#2A2A2A",
    borderWidth: 2,
    borderColor: "#4B5320",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  profileName: {
    color: "#E0E0E0",
    fontSize: 20,
    fontWeight: "700",
    marginTop: 16,
  },
  profileEmail: {
    color: "#666",
    fontSize: 12,
    letterSpacing: 2,
    marginTop: 4,
  },
  daysBadge: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 3,
    backgroundColor: "rgba(75,83,32,0.08)",
  },
  daysBadgeText: {
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: "700",
  },

  section: { paddingHorizontal: 24, marginTop: 16 },

  sectionDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#333" },
  dividerLabel: {
    color: "#555",
    fontSize: 10,
    letterSpacing: 3,
    marginHorizontal: 12,
    textTransform: "uppercase",
  },

  // Membership Card
  membershipCard: {
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 3,
    padding: 16,
  },
  dateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dateLabel: {
    color: "#A0A0A0",
    fontSize: 10,
    letterSpacing: 2,
    marginLeft: 8,
    textTransform: "uppercase",
  },
  dateButton: {
    backgroundColor: "#2A2A2A",
    borderWidth: 1,
    borderColor: "#4B5320",
    borderRadius: 3,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dateButtonText: {
    color: "#E0E0E0",
    fontSize: 12,
    fontWeight: "600",
  },
  dateDivider: {
    height: 1,
    backgroundColor: "#333",
    marginVertical: 12,
  },

  // Activity
  emptyCard: {
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 3,
    padding: 24,
    alignItems: "center",
  },
  emptyText: {
    color: "#555",
    fontSize: 11,
    letterSpacing: 3,
    marginTop: 12,
  },
  logItem: {
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 3,
    padding: 12,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  logDate: {
    color: "#666",
    fontSize: 10,
    letterSpacing: 1,
  },
  logTime: {
    color: "#E0E0E0",
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  logStatus: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
  },

  // View All Button
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(75,83,32,0.1)",
    borderWidth: 1,
    borderColor: "rgba(75,83,32,0.3)",
    borderRadius: 3,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  viewAllText: {
    color: "#4B5320",
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: "700",
    marginLeft: 10,
    textTransform: "uppercase",
  },

  // Modal
  modalSafeArea: {
    flex: 1,
    backgroundColor: "#121212",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  modalTitle: {
    color: "#E0E0E0",
    fontSize: 14,
    letterSpacing: 4,
    fontWeight: "800",
    marginLeft: 10,
    textTransform: "uppercase",
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#2A2A2A",
    borderWidth: 1,
    borderColor: "#333",
    alignItems: "center",
    justifyContent: "center",
  },
  modalDivider: {
    height: 1,
    backgroundColor: "#333",
    marginHorizontal: 24,
    marginBottom: 16,
  },
  modalLoadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  modalLoadingText: {
    color: "#4B5320",
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: "600",
  },
  modalEmptyText: {
    color: "#555",
    fontSize: 12,
    letterSpacing: 3,
    fontWeight: "700",
    marginTop: 16,
  },
  modalCountText: {
    color: "#555",
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: 12,
    textTransform: "uppercase",
  },

  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  footerText: {
    color: "#444",
    fontSize: 8,
    letterSpacing: 3,
    marginLeft: 6,
  },
});
