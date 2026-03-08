import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, ScrollView,
  Animated, Easing, Modal, Pressable, ActivityIndicator, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { UserPlus, LogOut as LogOutIcon, Radio, Clock, User, X, Search, Dumbbell } from "lucide-react-native";
import SecurityBell from "@/components/admin/SecurityBell";
import { useAlert } from "@/components/CustomAlert";
import { supabase } from "@/lib/supabase";

interface InsideMember {
  id: string;
  full_name: string;
  entry_time: string;
  log_id: string;
}

interface ActiveMemberOption {
  id: string;
  full_name: string;
}

function formatElapsed(entryStr: string, now: Date) {
  const entry = new Date(entryStr);
  const min = Math.floor((now.getTime() - entry.getTime()) / 60000);
  const h = Math.floor(min / 60);
  return h > 0 ? `${h} saat ${min % 60} dk` : `${min} dk`;
}
function getElapsedColor(entryStr: string, now: Date) {
  const h = (now.getTime() - new Date(entryStr).getTime()) / 3600000;
  return h >= 3 ? "#E74C3C" : h >= 2 ? "#D4A017" : "#808080";
}



/** Get today's date string as YYYY-MM-DD in local time */
function getTodayStr() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

export default function AdminHomeScreen() {
  const [members, setMembers] = useState<InsideMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  // Manuel Giriş Modal
  const [manualEntryVisible, setManualEntryVisible] = useState(false);
  const [activeMemberOptions, setActiveMemberOptions] = useState<ActiveMemberOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [processingEntry, setProcessingEntry] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [meSearch, setMeSearch] = useState("");
  const { showAlert } = useAlert();

  // Clock tick every 30s for elapsed time display
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(i); }, []);

  // ═══════════ FETCH INSIDE MEMBERS ═══════════
  const fetchInsideMembers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("gym_logs")
        .select("id, user_id, entry_time, profiles!inner(full_name)")
        .eq("status", "inside")
        .order("entry_time", { ascending: false });

      if (error) { console.error("Fetch error:", error); return; }

      const mapped: InsideMember[] = (data ?? []).map((row: any) => ({
        id: row.user_id,
        full_name: row.profiles?.full_name ?? "İsimsiz",
        entry_time: row.entry_time,
        log_id: row.id,
      }));
      setMembers(mapped);
    } catch (e) {
      console.error("Inside members fetch failed:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInsideMembers(); }, [fetchInsideMembers]);

  // Realtime subscription for gym_logs changes
  useEffect(() => {
    const channel = supabase
      .channel("admin_radar")
      .on("postgres_changes", { event: "*", schema: "public", table: "gym_logs" }, () => {
        fetchInsideMembers();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchInsideMembers]);

  // ═══════════ AUTO-REFRESH (15s polling for live radar) ═══════════
  useEffect(() => {
    const interval = setInterval(() => {
      fetchInsideMembers();
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchInsideMembers]);

  // ═══════════ EVICT (CHECK OUT) ═══════════
  const handleEvict = useCallback((m: InsideMember) => {
    showAlert("ÇIKIŞ ONAYI", `"${m.full_name}" adlı üyeyi çıkış yapmış olarak işaretle?`, [
      { text: "İPTAL", style: "cancel" },
      {
        text: "ÇIKIŞ YAP", style: "destructive", onPress: async () => {
          try {
            console.log("🔄 [ÇIKIŞ] Üye:", m.full_name, "Log ID:", m.log_id, "User ID:", m.id);

            const { data: logData, error: logError } = await supabase
              .from("gym_logs")
              .update({ exit_time: new Date().toISOString(), status: "completed" })
              .eq("id", m.log_id)
              .select();

            console.log("📦 [ÇIKIŞ] gym_logs response — data:", JSON.stringify(logData), "error:", JSON.stringify(logError));

            if (logError) {
              console.error("[ÇIKIŞ] gym_logs UPDATE hatası:", logError.message);
              showAlert("Çıkış Hatası", `gym_logs güncellenemedi:\n${logError.message}`);
              return;
            }

            if (!logData || logData.length === 0) {
              console.error("[ÇIKIŞ] gym_logs 0 satır güncellendi — RLS engeli!");
              showAlert("Çıkış Başarısız", "Çıkış kaydı Supabase tarafında uygulanmadı. RLS politikası eksik olabilir.");
              return;
            }

            const { data: profileData, error: profileError } = await supabase
              .from("profiles")
              .update({ is_inside: false })
              .eq("id", m.id)
              .select();

            if (profileError) {
              console.warn("[ÇIKIŞ] is_inside güncellenemedi:", profileError.message);
            }

            console.log("[ÇIKIŞ] Başarılı");
            await fetchInsideMembers();
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Bilinmeyen hata.";
            console.error("[ÇIKIŞ] Exception:", msg);
            showAlert("Çıkış Hatası", `Çıkış kaydedilemedi:\n${msg}`);
          }
        }
      },
    ]);
  }, [fetchInsideMembers, showAlert]);

  // ═══════════ PULL-TO-REFRESH ═══════════
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchInsideMembers();
    setRefreshing(false);
  }, [fetchInsideMembers]);

  // ═══════════ MANUEL GİRİŞ ═══════════
  const fetchActiveMembersForEntry = useCallback(async () => {
    setLoadingOptions(true);
    try {
      // Get active members (status=active, membership not expired)
      const todayStr = getTodayStr();
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "member")
        .eq("status", "active")
        .gte("membership_end", todayStr)
        .order("full_name", { ascending: true });

      if (error) { console.error("Active members fetch error:", error); return; }

      // Filter out members who are already inside
      const insideIds = new Set(members.map(m => m.id));
      const available = (data ?? []).filter(m => !insideIds.has(m.id));
      setActiveMemberOptions(available);
    } catch (e) {
      console.error("Active members fetch failed:", e);
    } finally {
      setLoadingOptions(false);
    }
  }, [members]);

  const openManualEntry = useCallback(() => {
    setMeSearch("");
    setManualEntryVisible(true);
    fetchActiveMembersForEntry();
  }, [fetchActiveMembersForEntry]);

  // Filtered member options for manual entry search
  const filteredMeOptions = meSearch.trim()
    ? activeMemberOptions.filter(m => m.full_name.toLowerCase().includes(meSearch.toLowerCase()))
    : activeMemberOptions;

  const handleManualCheckIn = useCallback(async (member: ActiveMemberOption) => {
    setProcessingEntry(true);
    try {
      console.log("🔄 [MANUEL GİRİŞ] Üye:", member.full_name, "ID:", member.id);

      // 1) gym_logs INSERT with .select() to verify
      const { data: logData, error: logError } = await supabase
        .from("gym_logs")
        .insert({
          user_id: member.id,
          entry_time: new Date().toISOString(),
          status: "inside",
        })
        .select();

      console.log("📦 [MANUEL GİRİŞ] gym_logs response — data:", JSON.stringify(logData), "error:", JSON.stringify(logError));

      if (logError) {
        console.error("[MANUEL GİRİŞ] gym_logs INSERT hatası:", logError.message, logError.details, logError.hint);
        showAlert("GİRİŞ HATASI", `Giriş kaydı oluşturulamadı:\n${logError.message}\n\nRLS politikası eksik olabilir.`);
        return;
      }

      if (!logData || logData.length === 0) {
        console.error("[MANUEL GİRİŞ] gym_logs 0 satır eklendi — RLS engeli!");
        showAlert("GİRİŞ BAŞARISIZ", "Giriş kaydı oluşturulmadı. RLS politikası admin INSERT iznini engelliyor olabilir.");
        return;
      }

      // 2) profiles is_inside update with .select() to verify
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .update({ is_inside: true })
        .eq("id", member.id)
        .select();

      console.log("📦 [MANUEL GİRİŞ] profiles response — data:", JSON.stringify(profileData), "error:", JSON.stringify(profileError));

      if (profileError) {
        console.warn("[MANUEL GİRİŞ] is_inside güncellenemedi:", profileError.message);
        // Don't block — gym_log was already created
      }

      if (!profileData || profileData.length === 0) {
        console.warn("[MANUEL GİRİŞ] profiles 0 satır güncellendi (RLS engeli olabilir)");
      }

      console.log("[MANUEL GİRİŞ] Başarılı");
      await fetchInsideMembers();
      setManualEntryVisible(false);
      showAlert("GİRİŞ YAPILDI", `"${member.full_name}" salona giriş yaptı.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bilinmeyen hata oluştu.";
      console.error("[MANUEL GİRİŞ] Exception:", msg);
      showAlert("HATA", `Giriş kaydedilemedi:\n${msg}`);
    } finally {
      setProcessingEntry(false);
    }
  }, [fetchInsideMembers, showAlert]);

  const renderMember = useCallback(({ item }: { item: InsideMember }) => {
    const elapsed = formatElapsed(item.entry_time, now);
    const color = getElapsedColor(item.entry_time, now);
    return (
      <View style={st.memberCard}>
        <View style={st.memberLeft}>
          <View style={st.memberAvatar}><User size={18} color="#555" /></View>
          <View style={st.memberInfo}>
            <Text style={st.memberName} numberOfLines={1}>{item.full_name}</Text>
            <View style={st.elapsedRow}><Clock size={11} color={color} /><Text style={[st.elapsedText, { color }]}>{elapsed}</Text></View>
          </View>
        </View>
        <TouchableOpacity onPress={() => handleEvict(item)} style={st.evictBtn} activeOpacity={0.7}>
          <LogOutIcon size={16} color="#C0392B" />
        </TouchableOpacity>
      </View>
    );
  }, [now, handleEvict]);

  return (
    <SafeAreaView style={st.safeArea} edges={["top"]}>
      <View style={st.container}>
        <View style={st.header}>
          <View style={st.headerLeft}>
            <View style={st.badge}>
              <Dumbbell size={20} color="#4B5320" />
            </View>
            <Text style={st.headerTitle}>YÖNETİM PANELİ</Text>
          </View>
          <SecurityBell />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1 }}
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
          <View style={st.heroSection}>
            <View style={st.heroDivider}><View style={st.heroDivLine} /><Radio size={12} color="#4B5320" /><View style={st.heroDivLine} /></View>
            <Text style={st.heroLabel}>ŞU AN İÇERİDE</Text>
            <Text style={st.heroCount}>{members.length}</Text>
            <Text style={st.heroUnit}>AKTİF ÜYE</Text>

            <View style={st.heroDivider}>
              <View style={st.heroDivLine} />
              <TouchableOpacity onPress={openManualEntry} style={st.manualEntryBtn} activeOpacity={0.7}>
                <UserPlus size={14} color="#E0E0E0" /><Text style={st.manualEntryText}>MANUEL GİRİŞ</Text>
              </TouchableOpacity>
              <View style={st.heroDivLine} />
            </View>
          </View>

          <View style={st.listHeader}><View style={st.listHeaderLine} /><Text style={st.listHeaderText}>İÇERİDEKİ ÜYELER</Text><View style={st.listHeaderLine} /></View>

          <View style={st.listFrame}>
            {members.length === 0 ? (
              <View style={st.emptyWrap}>
                <Text style={st.emptyText}>{loading ? "YÜKLENİYOR..." : "SALON BOŞ"}</Text>
                <View style={st.emptyDivider}><View style={st.emptyDivLine} /><View style={st.emptyDivDot} /><View style={st.emptyDivLine} /></View>
                <Text style={st.emptySub}>{loading ? "Veriler alınıyor..." : "Şu anda salonda kimse bulunmuyor."}</Text>
              </View>
            ) : (
              <View style={st.listContent}>
                {members.map(item => (
                  <View key={item.log_id}>{renderMember({ item } as any)}</View>
                ))}
              </View>
            )}
          </View>

        </ScrollView>

        <View style={st.footer}><View style={st.footerLine} /><Text style={st.footerText}>BARİKAT • CANLI TAKİP</Text><View style={st.footerLine} /></View>
      </View>

      {/* ═══════════ MANUEL GİRİŞ MODAL ═══════════ */}
      <Modal visible={manualEntryVisible} transparent animationType="fade" onRequestClose={() => setManualEntryVisible(false)}>
        <Pressable style={st.meOverlay} onPress={() => setManualEntryVisible(false)}>
          <Pressable style={st.meBox} onPress={() => {}}>
            <View style={st.meHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <UserPlus size={16} color="#4B5320" />
                <Text style={st.meTitle}>MANUEL GİRİŞ</Text>
              </View>
              <TouchableOpacity onPress={() => setManualEntryVisible(false)} style={st.meCloseBtn}>
                <X size={16} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={st.meSep} />

            {/* Search Bar */}
            <View style={st.meSearchWrap}>
              <Search size={14} color="#666" />
              <TextInput
                style={st.meSearchInput}
                placeholder="İsim ara..."
                placeholderTextColor="#555"
                value={meSearch}
                onChangeText={setMeSearch}
                autoCorrect={false}
              />
              {meSearch.length > 0 && (
                <TouchableOpacity onPress={() => setMeSearch("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={14} color="#666" />
                </TouchableOpacity>
              )}
            </View>

            {loadingOptions ? (
              <View style={st.meLoadingWrap}>
                <ActivityIndicator color="#4B5320" />
                <Text style={st.meLoadingText}>Aktif üyeler yükleniyor...</Text>
              </View>
            ) : filteredMeOptions.length === 0 ? (
              <View style={st.meLoadingWrap}>
                <Text style={st.meEmptyText}>{meSearch.trim() ? "Eşleşen üye bulunamadı." : "İçeri girebilecek aktif üye bulunamadı."}</Text>
              </View>
            ) : (
              <FlatList
                data={filteredMeOptions}
                keyExtractor={i => i.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 8 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={st.meMemberCard}
                    activeOpacity={0.7}
                    onPress={() => handleManualCheckIn(item)}
                    disabled={processingEntry}
                  >
                    <View style={st.meMemberLeft}>
                      <View style={st.meMemberAvatar}><User size={14} color="#555" /></View>
                      <Text style={st.meMemberName} numberOfLines={1}>{item.full_name}</Text>
                    </View>
                    <View style={st.meEntryBtn}>
                      <UserPlus size={14} color="#4B5320" />
                    </View>
                  </TouchableOpacity>
                )}
                ListHeaderComponent={
                  meSearch.trim() ? <Text style={st.meCountText}>{filteredMeOptions.length} / {activeMemberOptions.length} aktif üye</Text> : null
                }
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const CARD_BG = "rgba(26,26,26,0.65)";
const CARD_BORDER = "#333";

const st = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "transparent" },
  container: { flex: 1, paddingHorizontal: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 4, paddingBottom: 12 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  badge: { width: 42, height: 42, borderRadius: 8, backgroundColor: "rgba(26,26,26,0.35)", borderWidth: 1, borderColor: "#333", alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#E0E0E0", fontSize: 16, fontWeight: "900", letterSpacing: 4 },
  heroSection: { alignItems: "center", paddingVertical: 16, backgroundColor: "rgba(26,26,26,0.35)", borderRadius: 8, borderWidth: 1, borderColor: CARD_BORDER, marginBottom: 16 },
  heroDivider: { flexDirection: "row", alignItems: "center", width: "100%", paddingHorizontal: 20, gap: 10 },
  heroDivLine: { flex: 1, height: 1, backgroundColor: "#333" },
  heroLabel: { color: "#808080", fontSize: 11, fontWeight: "700", letterSpacing: 5, marginTop: 14, marginBottom: 4 },
  heroCount: { color: "#E0E0E0", fontSize: 72, fontWeight: "900", letterSpacing: 4, lineHeight: 80 },
  heroUnit: { color: "#4B5320", fontSize: 10, fontWeight: "700", letterSpacing: 5, marginBottom: 16, marginTop: 2 },
  manualEntryBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(75,83,32,0.25)", borderWidth: 1, borderColor: "rgba(75,83,32,0.6)", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 4 },
  manualEntryText: { color: "#E0E0E0", fontSize: 10, fontWeight: "700", letterSpacing: 2 },

  listHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  listHeaderLine: { flex: 1, height: 1, backgroundColor: "#333" },
  listHeaderText: { color: "#555", fontSize: 9, fontWeight: "700", letterSpacing: 3 },
  listContent: { padding: 8, gap: 8 },

  memberCard: { flexDirection: "row", alignItems: "center", backgroundColor: CARD_BG, borderWidth: 1, borderColor: CARD_BORDER, borderRadius: 6, paddingVertical: 12, paddingHorizontal: 12 },
  memberLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  memberAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.3)", borderWidth: 1, borderColor: "#333", alignItems: "center", justifyContent: "center" },
  memberInfo: { flex: 1, gap: 3 },
  memberName: { color: "#E0E0E0", fontSize: 14, fontWeight: "700", letterSpacing: 0.5 },
  elapsedRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  elapsedText: { fontSize: 11, fontWeight: "600", letterSpacing: 1 },
  evictBtn: { width: 40, height: 40, borderRadius: 6, backgroundColor: "rgba(139,0,0,0.12)", borderWidth: 1, borderColor: "rgba(139,0,0,0.3)", alignItems: "center", justifyContent: "center" },

  listFrame: { flex: 1, backgroundColor: "rgba(26,26,26,0.35)", borderWidth: 1, borderColor: CARD_BORDER, borderRadius: 8, overflow: "hidden", minHeight: 200 },
  radarFrameTop: { backgroundColor: CARD_BG, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: CARD_BORDER, borderTopLeftRadius: 8, borderTopRightRadius: 8, height: 8 },
  radarFrameBottom: { backgroundColor: CARD_BG, borderBottomWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: CARD_BORDER, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, height: 8 },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 48, paddingHorizontal: 24, gap: 10 },
  emptyText: { color: "#444", fontSize: 14, fontWeight: "800", letterSpacing: 4 },
  emptyDivider: { flexDirection: "row", alignItems: "center", width: "60%", gap: 8, marginVertical: 4 },
  emptyDivLine: { flex: 1, height: 1, backgroundColor: "#2A2A2A" },
  emptyDivDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#333" },
  emptySub: { color: "#383838", fontSize: 10, letterSpacing: 2, textAlign: "center", fontWeight: "700" },

  footer: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  footerLine: { flex: 1, height: 1, backgroundColor: "#1E1E1E" },
  footerText: { color: "#2A2A2A", fontSize: 8, fontWeight: "600", letterSpacing: 3 },

  // ═══════════ MANUEL GİRİŞ MODAL ═══════════
  meOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", alignItems: "center", paddingHorizontal: 20 },
  meBox: { width: "100%", maxWidth: 380, maxHeight: "65%", backgroundColor: "#1A1A1A", borderRadius: 6, borderWidth: 1, borderColor: "#4B5320", paddingVertical: 18, paddingHorizontal: 16, shadowColor: "#4B5320", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 15, elevation: 12 },
  meHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  meTitle: { color: "#E0E0E0", fontSize: 13, fontWeight: "800", letterSpacing: 2 },
  meCloseBtn: { padding: 4, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.05)" },
  meSep: { height: 1, backgroundColor: "#333", marginBottom: 12 },
  meLoadingWrap: { alignItems: "center", justifyContent: "center", paddingVertical: 32, gap: 12 },
  meLoadingText: { color: "#666", fontSize: 11, letterSpacing: 1 },
  meEmptyText: { color: "#555", fontSize: 11, letterSpacing: 1, textAlign: "center" },
  meCountText: { color: "#555", fontSize: 9, letterSpacing: 2, marginBottom: 8, fontWeight: "700", textTransform: "uppercase" },
  meMemberCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "rgba(26,26,26,0.65)", borderWidth: 1, borderColor: "#333",
    borderRadius: 4, paddingVertical: 12, paddingHorizontal: 12, marginBottom: 6,
  },
  meMemberLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  meMemberAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(0,0,0,0.3)", borderWidth: 1, borderColor: "#333", alignItems: "center", justifyContent: "center" },
  meMemberName: { color: "#E0E0E0", fontSize: 13, fontWeight: "600", flex: 1 },
  meEntryBtn: {
    width: 36, height: 36, borderRadius: 6,
    backgroundColor: "rgba(75,83,32,0.25)", borderWidth: 1, borderColor: "rgba(75,83,32,0.5)",
    alignItems: "center", justifyContent: "center",
  },
  meSearchWrap: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(0,0,0,0.3)", borderWidth: 1, borderColor: "#333",
    borderRadius: 4, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 12,
  },
  meSearchInput: {
    flex: 1, color: "#E0E0E0", fontSize: 13, padding: 0, letterSpacing: 0.5,
  },
});
