import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Modal, Pressable, ScrollView, TextInput, Platform, ActivityIndicator, RefreshControl, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Users, User, Shield, ChevronRight, X, Calendar,
  Clock, UserCheck, UserX, Search, Edit3,
} from "lucide-react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import SecurityBell from "@/components/admin/SecurityBell";
import { useAlert } from "@/components/CustomAlert";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/types";
import { calculateMembershipStatus } from "@/utils/dateHelpers";

type TabKey = "active" | "inactive" | "expired";

function getBarColor(d: number) { return d <= 5 ? "#E74C3C" : d <= 14 ? "#D4A017" : "#4B5320"; }
function parseDate(s: string) { const d = new Date(s); return isNaN(d.getTime()) ? new Date() : d; }
function fmtDate(dt: Date | null | undefined): string {
  if (!dt || isNaN(dt.getTime())) return "—";
  return `${String(dt.getDate()).padStart(2, "0")}.${String(dt.getMonth() + 1).padStart(2, "0")}.${dt.getFullYear()}`;
}

function daysLeft(endStr: string | null | undefined, currentStatus: string | null | undefined): number {
  return calculateMembershipStatus(endStr, currentStatus || "inactive").daysLeft;
}

/** Determine effective status considering membership_end date */
function getEffectiveStatus(m: Profile): "active" | "inactive" | "frozen" | "pending" | "expired" {
  return calculateMembershipStatus(m.membership_end, m.status || "inactive").status as any;
}

const CB = "rgba(26,26,26,0.65)";
const CBR = "#333";
const AVATAR_LIST_SIZE = 40;

function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function MemberAvatar({ item, borderColor = "#333" }: { item: Profile; borderColor?: string }) {
  if (item.avatar_url) {
    return (
      <Image
        source={{ uri: item.avatar_url }}
        style={[st.avatarImg, { borderColor }]}
      />
    );
  }
  return (
    <View style={[st.avatar, { borderColor }]}>
      <Text style={st.avatarInitials}>{getInitials(item.full_name)}</Text>
    </View>
  );
}

export default function AdminMembersScreen() {
  // ═══════════ DATA STATE ═══════════
  const [allMembers, setAllMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const { showAlert } = useAlert();

  const [activeTab, setActiveTab] = useState<TabKey>("active");
  const [searchQuery, setSearchQuery] = useState("");

  // Dossier modal state
  const [isDossierVisible, setIsDossierVisible] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Profile | null>(null);
  const [dossierStart, setDossierStart] = useState(new Date());
  const [dossierEnd, setDossierEnd] = useState(new Date());
  const [freezeQuota, setFreezeQuota] = useState("1");
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showFreezeInput, setShowFreezeInput] = useState(false);
  const [freezeDays, setFreezeDays] = useState("15");

  // ═══════════ FETCH ALL MEMBERS ═══════════
  const fetchMembers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "member")
        .order("full_name", { ascending: true });

      if (error) { console.error("Members fetch error:", error); return; }
      setAllMembers(data ?? []);
    } catch (e) {
      console.error("Members fetch failed:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  // ═══════════ PULL-TO-REFRESH ═══════════
  const onRefreshMembers = useCallback(async () => {
    setRefreshing(true);
    await fetchMembers();
    setRefreshing(false);
  }, [fetchMembers]);

  // ═══════════ CATEGORIZE MEMBERS ═══════════
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeMembers = useMemo(() =>
    allMembers.filter(m => getEffectiveStatus(m) === "active"),
    [allMembers]
  );

  const inactiveMembers = useMemo(() =>
    allMembers.filter(m => getEffectiveStatus(m) === "inactive"),
    [allMembers]
  );

  const pendingMembers = useMemo(() =>
    allMembers.filter(m => getEffectiveStatus(m) === "pending"),
    [allMembers]
  );

  const frozenMembers = useMemo(() =>
    allMembers.filter(m => getEffectiveStatus(m) === "frozen"),
    [allMembers]
  );

  const expiredMembers = useMemo(() =>
    allMembers.filter(m => getEffectiveStatus(m) === "expired"),
    [allMembers]
  );

  const inactiveTabCount = inactiveMembers.length + pendingMembers.length + frozenMembers.length;

  const TABS: { key: TabKey; label: string; count: number }[] = [
    { key: "active", label: "AKTİF", count: activeMembers.length },
    { key: "inactive", label: "İNAKTİF", count: inactiveTabCount },
    { key: "expired", label: "BİTENLER", count: expiredMembers.length },
  ];

  // ═══════════ SEARCH FILTER ═══════════
  const fA = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const list = q ? activeMembers.filter(m => m.full_name.toLowerCase().includes(q)) : activeMembers;
    return [...list].sort((a, b) => daysLeft(a.membership_end, a.status) - daysLeft(b.membership_end, b.status));
  }, [searchQuery, activeMembers]);

  const fE = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return q ? expiredMembers.filter(m => m.full_name.toLowerCase().includes(q)) : expiredMembers;
  }, [searchQuery, expiredMembers]);

  // ═══════════ DOSSIER ═══════════
  const openDossier = useCallback((m: Profile) => {
    setSelectedMember(m);
    setDossierStart(m.membership_start ? parseDate(m.membership_start) : new Date());
    setDossierEnd(m.membership_end ? parseDate(m.membership_end) : new Date());
    setFreezeQuota(String(m.freeze_quota ?? 1));
    setShowStartPicker(false);
    setShowEndPicker(false);
    setIsEditMode(false);
    setShowFreezeInput(false);
    setFreezeDays("15");
    setIsDossierVisible(true);
  }, []);

  // ═══════════ ACTION: AKTİF ET (for inactive/frozen/pending) ═══════════
  const handleActivate = useCallback(async () => {
    if (!selectedMember) return;
    if (dossierEnd <= dossierStart) {
      showAlert("HATA", "Bitiş tarihi başlangıçtan sonra olmalıdır.");
      return;
    }
    setSaving(true);
    try {
      // timestamptz columns need ISO format
      const startISO = new Date(dossierStart.getFullYear(), dossierStart.getMonth(), dossierStart.getDate()).toISOString();
      const endISO = new Date(dossierEnd.getFullYear(), dossierEnd.getMonth(), dossierEnd.getDate(), 23, 59, 59).toISOString();

      const updatePayload = {
        membership_start: startISO,
        membership_end: endISO,
        freeze_quota: Number(freezeQuota),
        status: "active",
        updated_at: new Date().toISOString(),
      };

      console.log("🔄 [AKTİF ET] Payload:", JSON.stringify(updatePayload), "ID:", selectedMember.id);

      const { data, error } = await supabase
        .from("profiles")
        .update(updatePayload)
        .eq("id", selectedMember.id)
        .select();

      console.log("📦 [AKTİF ET] Response — data:", JSON.stringify(data), "error:", JSON.stringify(error));

      if (error) {
        console.error("[AKTİF ET] Supabase error:", error.message, error.details, error.hint);
        showAlert("GÜNCELLEME HATASI", `Supabase hatası: ${error.message}`);
        return;
      }

      // RLS silent failure check: update returned no rows
      if (!data || data.length === 0) {
        console.error("[AKTİF ET] 0 satır güncellendi — RLS politikası engellemiş olabilir!");
        showAlert(
          "GÜNCELLEME BAŞARISIZ",
          "Supabase güncellemeyi kabul etti ancak hiçbir satır değişmedi.\n\nBu genellikle RLS (Row Level Security) politikalarından kaynaklanır.\n\nSupabase Dashboard > SQL Editor'den şu komutu çalıştırın:\n\nCREATE POLICY \"Admins can update all profiles\" ON public.profiles FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));"
        );
        return;
      }

      console.log("[AKTİF ET] Başarılı. Güncellenen satır:", JSON.stringify(data[0]));

      // Refresh list FIRST, then show success
      await fetchMembers();
      setIsDossierVisible(false);
      setSelectedMember(null);

      showAlert("BAŞARILI", "Üye aktif edildi ve bilgileri güncellendi.", [{ text: "TAMAM" }]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bilinmeyen hata oluştu.";
      console.error("[AKTİF ET] Exception:", msg);
      showAlert("HATA", msg);
    } finally {
      setSaving(false);
    }
  }, [selectedMember, dossierStart, dossierEnd, freezeQuota, fetchMembers]);

  // ═══════════ ACTION: DONDUR (smart freeze with days input) ═══════════
  const handleFreezeConfirm = useCallback(async () => {
    if (!selectedMember) return;
    const days = parseInt(freezeDays, 10);
    if (isNaN(days) || days <= 0) {
      showAlert("HATA", "Lütfen geçerli bir gün sayısı girin (1+).");
      return;
    }
    const currentQuota = selectedMember.freeze_quota ?? 0;
    if (currentQuota <= 0) {
      showAlert("DONDURMA HAKKI YOK", "Bu üyenin dondurma hakkı kalmamıştır.");
      return;
    }
    setSaving(true);
    try {
      // Extend membership_end by freezeDays
      const currentEnd = selectedMember.membership_end ? new Date(selectedMember.membership_end) : new Date();
      const newEnd = new Date(currentEnd.getTime() + days * 24 * 60 * 60 * 1000);
      const newEndISO = newEnd.toISOString();

      const updatePayload: Record<string, unknown> = {
        status: "frozen",
        membership_end: newEndISO,
        freeze_quota: Math.max(0, currentQuota - 1),
        freeze_start_date: new Date().toISOString(),
        planned_freeze_days: days,
        updated_at: new Date().toISOString(),
      };

      console.log("🔄 [DONDUR] Payload:", JSON.stringify(updatePayload), "ID:", selectedMember.id);

      const { data, error } = await supabase
        .from("profiles")
        .update(updatePayload)
        .eq("id", selectedMember.id)
        .select();

      console.log("📦 [DONDUR] Response — data:", JSON.stringify(data), "error:", JSON.stringify(error));

      if (error) {
        console.error("[DONDUR] Supabase error:", error.message);
        showAlert("GÜNCELLEME HATASI", `Supabase hatası: ${error.message}`);
        return;
      }

      if (!data || data.length === 0) {
        console.error("[DONDUR] 0 satır güncellendi — RLS engeli!");
        showAlert("GÜNCELLEME BAŞARISIZ", "Dondurma işlemi uygulanamadı. RLS politikası eksik olabilir.");
        return;
      }

      console.log("[DONDUR] Başarılı:", JSON.stringify(data[0]));
      await fetchMembers();
      setIsDossierVisible(false);
      setSelectedMember(null);
      setShowFreezeInput(false);
      showAlert("DONDURULDU", `Üyelik ${days} gün donduruldu. Bitiş tarihi ${fmtDate(newEnd)} olarak uzatıldı.\nKalan dondurma hakkı: ${Math.max(0, currentQuota - 1)}`, [{ text: "TAMAM" }]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bilinmeyen hata.";
      console.error("[DONDUR] Exception:", msg);
      showAlert("HATA", msg);
    } finally {
      setSaving(false);
    }
  }, [selectedMember, freezeDays, fetchMembers]);

  // ═══════════ ACTION: ERKEN DÖNÜŞ (Unfreeze — smart early return math) ═══════════
  const handleUnfreeze = useCallback(() => {
    if (!selectedMember) return;

    const freezeStart = selectedMember.freeze_start_date ? new Date(selectedMember.freeze_start_date) : null;
    const plannedDays = selectedMember.planned_freeze_days ?? 0;
    const currentEnd = selectedMember.membership_end ? new Date(selectedMember.membership_end) : new Date();

    // Calculate elapsed days since freeze started
    let gecenGun = 0;
    if (freezeStart) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const start = new Date(freezeStart);
      start.setHours(0, 0, 0, 0);
      gecenGun = Math.max(0, Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    }

    const iadeGun = Math.max(0, plannedDays - gecenGun);

    // Build confirmation message
    let confirmMsg = `"${selectedMember.full_name}" adlı üye aktif edilecek.`;
    if (plannedDays > 0 && freezeStart) {
      confirmMsg += `\n\nPlanlanan dondurma: ${plannedDays} gün`;
      confirmMsg += `\nGeçen süre: ${gecenGun} gün`;
      if (iadeGun > 0) {
        const newEnd = new Date(currentEnd.getTime() - iadeGun * 24 * 60 * 60 * 1000);
        confirmMsg += `\n\nÜye planlanandan ${iadeGun} gün erken döndü.`;
        confirmMsg += `\nBitiş tarihi ${iadeGun} gün geri çekilerek ${fmtDate(newEnd)} olacak.`;
      } else {
        confirmMsg += `\n\nPlanlanan dondurma süresi dolmuş, bitiş tarihi değişmeyecek.`;
      }
    }
    confirmMsg += "\n\nOnaylıyor musunuz?";

    showAlert("AKTİF ETME ONAYI", confirmMsg, [
      { text: "İPTAL", style: "cancel" },
      {
        text: "EVET, AKTİF ET",
        onPress: async () => {
          setSaving(true);
          try {
            // Calculate new end date
            let newEndDate = currentEnd;
            if (iadeGun > 0) {
              newEndDate = new Date(currentEnd.getTime() - iadeGun * 24 * 60 * 60 * 1000);
            }
            const newEndISO = newEndDate.toISOString();

            const updatePayload: Record<string, unknown> = {
              status: "active",
              membership_end: newEndISO,
              freeze_start_date: null,
              planned_freeze_days: null,
              updated_at: new Date().toISOString(),
            };

            console.log("🔄 [ERKEN DÖNÜŞ] Payload:", JSON.stringify(updatePayload), "ID:", selectedMember.id);
            console.log(`📊 [ERKEN DÖNÜŞ] Planlanan: ${plannedDays}, Geçen: ${gecenGun}, İade: ${iadeGun}`);

            const { data, error } = await supabase
              .from("profiles")
              .update(updatePayload)
              .eq("id", selectedMember.id)
              .select();

            console.log("📦 [ERKEN DÖNÜŞ] Response — data:", JSON.stringify(data), "error:", JSON.stringify(error));

            if (error) {
              console.error("[ERKEN DÖNÜŞ] Supabase error:", error.message);
              showAlert("GÜNCELLEME HATASI", `Supabase hatası: ${error.message}`);
              return;
            }
            if (!data || data.length === 0) {
              console.error("[ERKEN DÖNÜŞ] 0 satır güncellendi — RLS engeli!");
              showAlert("GÜNCELLEME BAŞARISIZ", "İşlem uygulanamadı. RLS politikası kontrol edin.");
              return;
            }

            console.log("[ERKEN DÖNÜŞ] Başarılı:", JSON.stringify(data[0]));
            await fetchMembers();
            setIsDossierVisible(false);
            setSelectedMember(null);

            let successMsg = "Üye başarıyla aktif edildi.";
            if (iadeGun > 0) {
              successMsg += `\nBitiş tarihi ${iadeGun} gün geri çekilerek ${fmtDate(newEndDate)} olarak güncellendi.`;
            }
            showAlert("AKTİF EDİLDİ", successMsg, [{ text: "TAMAM" }]);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Bilinmeyen hata.";
            console.error("[ERKEN DÖNÜŞ] Exception:", msg);
            showAlert("HATA", msg);
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  }, [selectedMember, fetchMembers]);

  // ═══════════ ACTION: KAYDET (edit mode save for active members) ═══════════
  const handleSaveEdit = useCallback(async () => {
    if (!selectedMember) return;
    if (dossierEnd <= dossierStart) {
      showAlert("HATA", "Bitiş tarihi başlangıçtan sonra olmalıdır.");
      return;
    }
    setSaving(true);
    try {
      const startISO = new Date(dossierStart.getFullYear(), dossierStart.getMonth(), dossierStart.getDate()).toISOString();
      const endISO = new Date(dossierEnd.getFullYear(), dossierEnd.getMonth(), dossierEnd.getDate(), 23, 59, 59).toISOString();

      const updatePayload = {
        membership_start: startISO,
        membership_end: endISO,
        freeze_quota: Number(freezeQuota),
        updated_at: new Date().toISOString(),
      };

      console.log("🔄 [KAYDET] Payload:", JSON.stringify(updatePayload), "ID:", selectedMember.id);

      const { data, error } = await supabase
        .from("profiles")
        .update(updatePayload)
        .eq("id", selectedMember.id)
        .select();

      if (error) {
        console.error("[KAYDET] Supabase error:", error.message);
        showAlert("GÜNCELLEME HATASI", `Supabase hatası: ${error.message}`);
        return;
      }
      if (!data || data.length === 0) {
        console.error("[KAYDET] 0 satır güncellendi");
        showAlert("GÜNCELLEME BAŞARISIZ", "Güncelleme uygulanamadı. RLS politikası kontrol edin.");
        return;
      }

      console.log("[KAYDET] Başarılı:", JSON.stringify(data[0]));
      await fetchMembers();
      setIsDossierVisible(false);
      setSelectedMember(null);
      showAlert("KAYDEDILDİ", "Üye bilgileri başarıyla güncellendi.", [{ text: "TAMAM" }]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bilinmeyen hata.";
      console.error("[KAYDET] Exception:", msg);
      showAlert("HATA", msg);
    } finally {
      setSaving(false);
    }
  }, [selectedMember, dossierStart, dossierEnd, freezeQuota, fetchMembers]);

  // ═══════════ ACTION: SİL (for expired members) ═══════════
  const handleDelete = useCallback(async () => {
    if (!selectedMember) return;
    showAlert(
      "SİLME ONAYI",
      `"${selectedMember.full_name}" adlı üyeyi kalıcı olarak silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz!`,
      [
        { text: "İPTAL", style: "cancel" },
        {
          text: "SİL",
          style: "destructive",
          onPress: async () => {
            setSaving(true);
            try {
              console.log("🔄 [SİL] ID:", selectedMember.id);

              const { data, error } = await supabase
                .from("profiles")
                .delete()
                .eq("id", selectedMember.id)
                .select();

              console.log("📦 [SİL] Response — data:", JSON.stringify(data), "error:", JSON.stringify(error));

              if (error) {
                console.error("[SİL] Supabase error:", error.message);
                showAlert("SİLME HATASI", `Supabase hatası: ${error.message}`);
                return;
              }

              if (!data || data.length === 0) {
                console.error("[SİL] 0 satır silindi — RLS engeli!");
                showAlert(
                  "SİLME BAŞARISIZ",
                  "Silme işlemi Supabase tarafında uygulanmadı. RLS politikası eksik olabilir.\n\nSupabase Dashboard'dan admin DELETE policy eklemeniz gerekiyor."
                );
                return;
              }

              console.log("[SİL] Başarılı");
              await fetchMembers();
              setIsDossierVisible(false);
              setSelectedMember(null);
              showAlert("🗑️ SİLİNDİ", "Üye başarıyla silindi.", [{ text: "TAMAM" }]);
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : "Bilinmeyen hata.";
              console.error("[SİL] Exception:", msg);
              showAlert("HATA", msg);
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  }, [selectedMember, fetchMembers]);

  // ═══════════ ACTION: YENİLE (for expired members — allows re-entering dates) ═══════════
  const handleRenew = useCallback(async () => {
    if (!selectedMember) return;
    if (dossierEnd <= dossierStart) {
      showAlert("HATA", "Bitiş tarihi başlangıçtan sonra olmalıdır.");
      return;
    }
    setSaving(true);
    try {
      const startISO = new Date(dossierStart.getFullYear(), dossierStart.getMonth(), dossierStart.getDate()).toISOString();
      const endISO = new Date(dossierEnd.getFullYear(), dossierEnd.getMonth(), dossierEnd.getDate(), 23, 59, 59).toISOString();

      const updatePayload = {
        membership_start: startISO,
        membership_end: endISO,
        freeze_quota: Number(freezeQuota),
        status: "active",
        updated_at: new Date().toISOString(),
      };

      console.log("🔄 [YENİLE] Payload:", JSON.stringify(updatePayload), "ID:", selectedMember.id);

      const { data, error } = await supabase
        .from("profiles")
        .update(updatePayload)
        .eq("id", selectedMember.id)
        .select();

      console.log("📦 [YENİLE] Response — data:", JSON.stringify(data), "error:", JSON.stringify(error));

      if (error) {
        console.error("[YENİLE] Supabase error:", error.message);
        showAlert("GÜNCELLEME HATASI", `Supabase hatası: ${error.message}`);
        return;
      }

      if (!data || data.length === 0) {
        console.error("[YENİLE] 0 satır güncellendi — RLS engeli!");
        showAlert(
          "GÜNCELLEME BAŞARISIZ",
          "Yenileme işlemi Supabase tarafında uygulanmadı. RLS politikası eksik olabilir."
        );
        return;
      }

      console.log("[YENİLE] Başarılı:", JSON.stringify(data[0]));
      await fetchMembers();
      setIsDossierVisible(false);
      setSelectedMember(null);
      showAlert("YENİLENDİ", "Üyelik başarıyla yenilendi ve aktif edildi.", [{ text: "TAMAM" }]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bilinmeyen hata.";
      console.error("[YENİLE] Exception:", msg);
      showAlert("HATA", msg);
    } finally {
      setSaving(false);
    }
  }, [selectedMember, dossierStart, dossierEnd, freezeQuota, fetchMembers]);

  // ═══════════ DETERMINE MODAL BUTTONS ═══════════
  const memberEffectiveStatus = selectedMember ? getEffectiveStatus(selectedMember) : null;

  // ═══════════ RENDERS ═══════════

  const renderActiveItem = useCallback(({ item }: { item: Profile }) => {
    const dl = daysLeft(item.membership_end, item.status);
    const barColor = getBarColor(dl);
    return (
      <TouchableOpacity style={st.memberCard} activeOpacity={0.7} onPress={() => openDossier(item)}>
        <MemberAvatar item={item} />
        <View style={st.cardInfo}>
          <Text style={st.memberName} numberOfLines={1}>{item.full_name}</Text>
        </View>
        <View style={st.statusBarWrap}>
          <View style={[st.statusBar, { backgroundColor: barColor }]} />
        </View>
        <ChevronRight size={14} color="#444" />
      </TouchableOpacity>
    );
  }, [openDossier]);

  // ---- INACTIVE ITEM RENDERERS (for FlatList) ----
  const renderPendingItem = useCallback(({ item }: { item: Profile }) => {
    const isPending = item.status === 'pending';
    return (
      <TouchableOpacity style={st.memberCard} activeOpacity={0.7} onPress={() => openDossier(item)}>
        <View style={[st.leftStripe, { backgroundColor: isPending ? '#FFFFFF' : '#D4A017' }]} />
        <MemberAvatar item={item} borderColor="rgba(212,160,23,0.4)" />
        <View style={st.cardInfo}><Text style={st.memberName}>{item.full_name}</Text><Text style={st.memberMeta}>Kayıt: {item.created_at ? fmtDate(new Date(item.created_at)) : '—'}</Text></View>
        <View style={[st.statusTag, { borderColor: 'rgba(212,160,23,0.3)', backgroundColor: 'rgba(212,160,23,0.08)' }]}><Text style={[st.statusTagText, { color: '#D4A017' }]}>{isPending ? 'BEKLEMEDE' : 'YENİ'}</Text></View>
      </TouchableOpacity>
    );
  }, [openDossier]);

  const renderFrozenItem = useCallback(({ item }: { item: Profile }) => (
    <TouchableOpacity style={st.memberCard} activeOpacity={0.7} onPress={() => openDossier(item)}>
      <View style={[st.leftStripe, { backgroundColor: '#5DADE2' }]} />
      <MemberAvatar item={item} borderColor="rgba(93,173,226,0.4)" />
      <View style={st.cardInfo}><Text style={st.memberName}>{item.full_name}</Text><Text style={st.memberMeta}>Dondurma hakkı: {item.freeze_quota ?? 0}</Text></View>
      <View style={[st.statusTag, { borderColor: 'rgba(128,128,128,0.3)', backgroundColor: 'rgba(128,128,128,0.08)' }]}><Text style={[st.statusTagText, { color: '#808080' }]}>ASKIDA</Text></View>
    </TouchableOpacity>
  ), [openDossier]);

  const renderExpiredItem = useCallback(({ item }: { item: Profile }) => {
    // expired member -> daysLeft returns 0, so instead we calculate how many days since expired manually or show a generic message.
    // to be precise, let's keep it simple.
    const sinceText = item.membership_end ? `${Math.abs(Math.ceil((new Date().getTime() - new Date(item.membership_end).getTime()) / (1000 * 60 * 60 * 24)))} gün önce` : "Tarih yok";
    return (
      <TouchableOpacity style={st.memberCard} activeOpacity={0.7} onPress={() => openDossier(item)}>
        <MemberAvatar item={item} borderColor="rgba(139,0,0,0.4)" />
        <View style={st.cardInfo}>
          <Text style={[st.memberName, { color: '#999' }]}>{item.full_name}</Text>
          <Text style={st.memberMeta}>{sinceText} doldu</Text>
        </View>
        <View style={[st.statusTag, { borderColor: 'rgba(139,0,0,0.3)', backgroundColor: 'rgba(139,0,0,0.08)' }]}><Text style={[st.statusTagText, { color: '#C0392B' }]}>SÜRESİ DOLDU</Text></View>
      </TouchableOpacity>
    );
  }, [openDossier]);

  // ---- FILTERED DATA for inactive split ----
  const inactivePendingData = React.useMemo(() => {
    const q = searchQuery.toLowerCase();
    const fi = q ? inactiveMembers.filter(m => m.full_name.toLowerCase().includes(q)) : inactiveMembers;
    const fp = q ? pendingMembers.filter(m => m.full_name.toLowerCase().includes(q)) : pendingMembers;
    return [...fi, ...fp];
  }, [searchQuery, inactiveMembers, pendingMembers]);

  const frozenData = React.useMemo(() => {
    const q = searchQuery.toLowerCase();
    return q ? frozenMembers.filter(m => m.full_name.toLowerCase().includes(q)) : frozenMembers;
  }, [searchQuery, frozenMembers]);

  const renderFrameContent = () => {
    if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#4B5320" /><Text style={[st.emptyHint, { marginTop: 12 }]}>Üyeler yükleniyor...</Text></View>;
    const refreshCtrl = (
      <RefreshControl refreshing={refreshing} onRefresh={onRefreshMembers} tintColor="#4B5320" colors={['#4B5320']} />
    );
    switch (activeTab) {
      case 'active':
        return <FlatList data={fA} renderItem={renderActiveItem} keyExtractor={i => i.id} contentContainerStyle={st.listContent} showsVerticalScrollIndicator={false} style={{ flex: 1 }} refreshControl={refreshCtrl} ListEmptyComponent={<Text style={st.emptyHint}>Sonuç bulunamadı</Text>} />;
      case 'inactive':
        return (
          <View style={{ flex: 1 }}>
            {/* TOP HALF: Onay Bekleyenler */}
            <View style={{ flex: 1 }}>
              <View style={st.splitHeader}><UserCheck size={11} color="#D4A017" /><Text style={[st.splitHeaderText, { color: '#D4A017' }]}>ONAY BEKLEYENLER</Text><View style={st.splitHeaderCount}><Text style={st.splitHeaderCountText}>{inactivePendingData.length}</Text></View></View>
              <FlatList data={inactivePendingData} renderItem={renderPendingItem} keyExtractor={i => i.id} contentContainerStyle={st.listContent} showsVerticalScrollIndicator={false} style={{ flex: 1 }} refreshControl={refreshCtrl} ListEmptyComponent={<Text style={st.emptyHint}>Onay bekleyen üye yok</Text>} />
            </View>
            {/* DIVIDER */}
            <View style={st.splitDivider} />
            {/* BOTTOM HALF: Dondurulanlar */}
            <View style={{ flex: 1 }}>
              <View style={st.splitHeader}><Clock size={11} color="#808080" /><Text style={[st.splitHeaderText, { color: '#808080' }]}>DONDURULANLAR</Text><View style={st.splitHeaderCount}><Text style={st.splitHeaderCountText}>{frozenData.length}</Text></View></View>
              <FlatList data={frozenData} renderItem={renderFrozenItem} keyExtractor={i => i.id} contentContainerStyle={st.listContent} showsVerticalScrollIndicator={false} style={{ flex: 1 }} ListEmptyComponent={<Text style={st.emptyHint}>Dondurulmuş üye yok</Text>} />
            </View>
          </View>
        );
      case 'expired':
        return <FlatList data={fE} renderItem={renderExpiredItem} keyExtractor={i => i.id} contentContainerStyle={st.listContent} showsVerticalScrollIndicator={false} style={{ flex: 1 }} refreshControl={refreshCtrl} ListEmptyComponent={<Text style={st.emptyHint}>Üyeliği sona eren kimse yok</Text>} />;
    }
  };

  // ═══════════ DYNAMIC MODAL BUTTONS ═══════════
  const renderDossierActions = () => {
    if (!selectedMember) return null;
    const es = memberEffectiveStatus;

    // FROZEN → "AKTİF ET" with early return math
    if (es === "frozen") {
      return (
        <TouchableOpacity
          style={[st.actionBtn, st.actionBtnActivate, saving && { opacity: 0.5 }]}
          activeOpacity={0.7}
          onPress={handleUnfreeze}
          disabled={saving}
        >
          {saving && <ActivityIndicator color="#E0E0E0" size="small" />}
          <Text style={st.actionBtnText}>{saving ? "İŞLENİYOR..." : "AKTİF ET"}</Text>
        </TouchableOpacity>
      );
    }

    // INACTIVE / PENDING → "AKTİF ET"
    if (es === "inactive" || es === "pending") {
      return (
        <TouchableOpacity
          style={[st.actionBtn, st.actionBtnActivate, saving && { opacity: 0.5 }]}
          activeOpacity={0.7}
          onPress={handleActivate}
          disabled={saving}
        >
          {saving && <ActivityIndicator color="#E0E0E0" size="small" />}
          <Text style={st.actionBtnText}>{saving ? "İŞLENİYOR..." : "AKTİF ET"}</Text>
        </TouchableOpacity>
      );
    }

    // ACTIVE → depends on isEditMode
    if (es === "active") {
      if (isEditMode) {
        // Edit mode: show KAYDET
        return (
          <TouchableOpacity
            style={[st.actionBtn, st.actionBtnActivate, saving && { opacity: 0.5 }]}
            activeOpacity={0.7}
            onPress={handleSaveEdit}
            disabled={saving}
          >
            {saving && <ActivityIndicator color="#E0E0E0" size="small" />}
            <Text style={st.actionBtnText}>{saving ? "İŞLENİYOR..." : "KAYDET"}</Text>
          </TouchableOpacity>
        );
      }
      // Read mode: show DONDUR (opens freeze input panel)
      return (
        <>
          {showFreezeInput ? (
            <View style={st.freezePanel}>
              <Text style={st.freezePanelTitle}>KAÇ GÜN DONDURULSUN?</Text>
              <View style={st.freezePanelRow}>
                <TouchableOpacity style={st.freezeDayBtn} onPress={() => setFreezeDays(String(Math.max(1, parseInt(freezeDays, 10) - 1 || 1)))}><Text style={st.freezeBtnText}>−</Text></TouchableOpacity>
                <TextInput
                  style={st.freezeDayInput}
                  value={freezeDays}
                  onChangeText={setFreezeDays}
                  keyboardType="number-pad"
                  maxLength={3}
                  selectTextOnFocus
                />
                <TouchableOpacity style={st.freezeDayBtn} onPress={() => setFreezeDays(String((parseInt(freezeDays, 10) || 0) + 1))}><Text style={st.freezeBtnText}>+</Text></TouchableOpacity>
                <Text style={st.freezeDayLabel}>GÜN</Text>
              </View>
              <Text style={st.freezePanelHint}>Kalan hak: {selectedMember?.freeze_quota ?? 0} | Bitiş tarihi {parseInt(freezeDays, 10) || 0} gün uzatılacak</Text>
              <View style={st.actionBtnRow}>
                <TouchableOpacity
                  style={[st.actionBtn, { flex: 1, borderColor: "#444", backgroundColor: "rgba(255,255,255,0.03)" }]}
                  activeOpacity={0.7}
                  onPress={() => setShowFreezeInput(false)}
                >
                  <Text style={[st.actionBtnText, { color: "#888" }]}>İPTAL</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[st.actionBtn, st.actionBtnFreeze, { flex: 1 }, saving && { opacity: 0.5 }]}
                  activeOpacity={0.7}
                  onPress={handleFreezeConfirm}
                  disabled={saving}
                >
                  {saving && <ActivityIndicator color="#E0E0E0" size="small" />}
                  <Text style={st.actionBtnText}>{saving ? "İŞLENİYOR..." : "ONAYLA"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={[st.actionBtn, st.actionBtnFreeze, saving && { opacity: 0.5 }]}
              activeOpacity={0.7}
              onPress={() => setShowFreezeInput(true)}
              disabled={saving}
            >
              <Text style={st.actionBtnText}>DONDUR</Text>
            </TouchableOpacity>
          )}
        </>
      );
    }

    // EXPIRED → Side-by-side "SİL" + "YENİLE"
    if (es === "expired") {
      return (
        <View style={st.actionBtnRow}>
          <TouchableOpacity
            style={[st.actionBtn, st.actionBtnDelete, { flex: 1 }, saving && { opacity: 0.5 }]}
            activeOpacity={0.7}
            onPress={handleDelete}
            disabled={saving}
          >
            {saving && <ActivityIndicator color="#E0E0E0" size="small" />}
            <Text style={st.actionBtnText}>SİL</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[st.actionBtn, st.actionBtnRenew, { flex: 1 }, saving && { opacity: 0.5 }]}
            activeOpacity={0.7}
            onPress={handleRenew}
            disabled={saving}
          >
            {saving && <ActivityIndicator color="#E0E0E0" size="small" />}
            <Text style={st.actionBtnText}>YENİLE</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return null;
  };

  // Helper: are inputs locked?
  const inputsLocked = memberEffectiveStatus === "active" && !isEditMode;

  return (
    <SafeAreaView style={st.safeArea} edges={["top"]}>
      <View style={st.container}>
        <View style={st.header}><View style={st.headerLeft}><View style={st.shieldBadge}><Users size={20} color="#4B5320" /></View><Text style={st.headerTitle}>ÜYELER</Text></View><SecurityBell /></View>
        <View style={st.searchBar}><Search size={16} color="#555" /><TextInput style={st.searchInput} placeholder="Üye ara..." placeholderTextColor="#555" value={searchQuery} onChangeText={setSearchQuery} autoCapitalize="none" autoCorrect={false} />{searchQuery.length > 0 && <TouchableOpacity onPress={() => setSearchQuery("")}><X size={16} color="#666" /></TouchableOpacity>}</View>
        <View style={st.tabBar}>{TABS.map(t => { const a = activeTab === t.key; return (<TouchableOpacity key={t.key} style={[st.tabItem, a && st.tabItemActive]} activeOpacity={0.7} onPress={() => setActiveTab(t.key)}><Text style={[st.tabText, a && st.tabTextActive]}>{t.label}</Text><View style={[st.tabCount, a && st.tabCountActive]}><Text style={[st.tabCountText, a && st.tabCountTextActive]}>{t.count}</Text></View></TouchableOpacity>); })}</View>
        <View style={st.commandFrame}>
          {renderFrameContent()}
        </View>
        <View style={st.footer}><View style={st.footerLine} /><Text style={st.footerText}>BARİKAT • ÜYE TAKİP</Text><View style={st.footerLine} /></View>
      </View>

      <Modal visible={isDossierVisible} transparent animationType="fade" onRequestClose={() => setIsDossierVisible(false)}>
        <Pressable style={st.modalOverlay} onPress={() => setIsDossierVisible(false)}>
          <Pressable style={st.modalBox} onPress={() => {}}>
            <View style={st.modalHeader}>
              <View style={st.modalHeaderLeft}><Shield size={18} color="#4B5320" /><Text style={st.modalTitle}>ÜYE BİLGİLERİ</Text></View>
              <View style={st.modalHeaderRight}>
                {/* Pencil edit toggle (only for active members) */}
                {memberEffectiveStatus === "active" && (
                  <TouchableOpacity
                    onPress={() => { setIsEditMode(!isEditMode); setShowFreezeInput(false); }}
                    style={[st.editToggleBtn, isEditMode && st.editToggleBtnActive]}
                    activeOpacity={0.7}
                  >
                    <Edit3 size={14} color={isEditMode ? "#E0E0E0" : "#666"} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setIsDossierVisible(false)} style={st.modalCloseBtn}><X size={16} color="#666" /></TouchableOpacity>
              </View>
            </View>
            <View style={st.modalSep}><View style={st.modalSepLine} /><User size={12} color="#4B5320" /><View style={st.modalSepLine} /></View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={st.dossierNameBox}><Text style={st.dossierName}>{selectedMember?.full_name ?? "—"}</Text></View>

              {/* Status badge in modal */}
              {selectedMember?.status && (
                <View style={{ alignItems: "center", marginBottom: 14 }}>
                  <View style={[st.statusTag, {
                    borderColor: memberEffectiveStatus === "frozen" ? "rgba(93,173,226,0.4)" : memberEffectiveStatus === "pending" ? "rgba(212,160,23,0.4)" : memberEffectiveStatus === "expired" ? "rgba(139,0,0,0.4)" : memberEffectiveStatus === "inactive" ? "rgba(212,160,23,0.4)" : "rgba(75,83,32,0.4)",
                    backgroundColor: memberEffectiveStatus === "frozen" ? "rgba(93,173,226,0.1)" : memberEffectiveStatus === "pending" ? "rgba(212,160,23,0.1)" : memberEffectiveStatus === "expired" ? "rgba(139,0,0,0.1)" : memberEffectiveStatus === "inactive" ? "rgba(212,160,23,0.1)" : "rgba(75,83,32,0.1)",
                    paddingHorizontal: 14, paddingVertical: 6,
                  }]}>
                    <Text style={[st.statusTagText, {
                      color: memberEffectiveStatus === "frozen" ? "#5DADE2" : memberEffectiveStatus === "pending" ? "#D4A017" : memberEffectiveStatus === "expired" ? "#C0392B" : memberEffectiveStatus === "inactive" ? "#D4A017" : "#4B5320",
                      fontSize: 10, letterSpacing: 3,
                    }]}>
                      {memberEffectiveStatus === "frozen" ? "DONDURULMUŞ" : memberEffectiveStatus === "pending" ? "ONAY BEKLİYOR" : memberEffectiveStatus === "expired" ? "SÜRESİ DOLMUŞ" : memberEffectiveStatus === "inactive" ? "İNAKTİF" : "AKTİF"}
                    </Text>
                  </View>
                </View>
              )}

              {/* ═══ FORM INPUTS (locked for active read-only, unlocked otherwise) ═══ */}
              <View style={[st.formGroup, inputsLocked && { opacity: 0.45 }]}>
                <View style={st.formLabelRow}><Calendar size={12} color="#4B5320" /><Text style={st.formLabel}>BAŞLANGIÇ</Text>{inputsLocked && <Text style={st.lockedHint}>🔒</Text>}</View>
                <TouchableOpacity style={st.dateBtn} onPress={() => { if (!inputsLocked) setShowStartPicker(true); }} activeOpacity={inputsLocked ? 1 : 0.7}>
                  <Text style={st.dateBtnText}>{fmtDate(dossierStart)}</Text>
                  <Calendar size={14} color="#555" />
                </TouchableOpacity>
                {showStartPicker && !inputsLocked && <DateTimePicker value={dossierStart || new Date()} minimumDate={new Date(2022, 0, 1)} mode="date" display={Platform.OS === "ios" ? "spinner" : "default"} onChange={(_e, d) => { setShowStartPicker(Platform.OS === "ios"); if (d) setDossierStart(d); }} themeVariant="dark" />}
              </View>

              <View style={[st.formGroup, inputsLocked && { opacity: 0.45 }]}>
                <View style={st.formLabelRow}><Calendar size={12} color="#4B5320" /><Text style={st.formLabel}>BİTİŞ</Text>{inputsLocked && <Text style={st.lockedHint}>🔒</Text>}</View>
                <TouchableOpacity style={st.dateBtn} onPress={() => { if (!inputsLocked) setShowEndPicker(true); }} activeOpacity={inputsLocked ? 1 : 0.7}>
                  <Text style={st.dateBtnText}>{fmtDate(dossierEnd)}</Text>
                  <Calendar size={14} color="#555" />
                </TouchableOpacity>
                {showEndPicker && !inputsLocked && <DateTimePicker value={dossierEnd || new Date()} minimumDate={new Date(2022, 0, 1)} mode="date" display={Platform.OS === "ios" ? "spinner" : "default"} onChange={(_e, d) => { setShowEndPicker(Platform.OS === "ios"); if (d) setDossierEnd(d); }} themeVariant="dark" />}
              </View>

              <View style={[st.freezeRow, inputsLocked && { opacity: 0.45 }]}>
                <View style={st.formLabelRow}><Clock size={12} color="#808080" /><Text style={st.formLabel}>DONDURMA</Text>{inputsLocked && <Text style={st.lockedHint}>🔒</Text>}</View>
                <View style={st.freezeInputWrap}>
                  <TouchableOpacity style={st.freezeBtn} onPress={() => { if (!inputsLocked) setFreezeQuota(String(Math.max(0, Number(freezeQuota) - 1))); }} disabled={inputsLocked}><Text style={st.freezeBtnText}>−</Text></TouchableOpacity>
                  <Text style={st.freezeValue}>{freezeQuota}</Text>
                  <TouchableOpacity style={st.freezeBtn} onPress={() => { if (!inputsLocked) setFreezeQuota(String(Number(freezeQuota) + 1)); }} disabled={inputsLocked}><Text style={st.freezeBtnText}>+</Text></TouchableOpacity>
                </View>
              </View>

              {/* ═══════════ DYNAMIC BUTTONS ═══════════ */}
              {renderDossierActions()}

              <TouchableOpacity onPress={() => setIsDossierVisible(false)} style={st.cancelBtn} activeOpacity={0.7}><Text style={st.cancelText}>İPTAL</Text></TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "transparent" },
  container: { flex: 1, paddingHorizontal: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 4, paddingBottom: 10 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  shieldBadge: { width: 42, height: 42, borderRadius: 8, backgroundColor: CB, borderWidth: 1, borderColor: CBR, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#E0E0E0", fontSize: 16, fontWeight: "900", letterSpacing: 4 },
  searchBar: { flexDirection: "row", alignItems: "center", backgroundColor: CB, borderWidth: 1, borderColor: CBR, borderRadius: 6, paddingHorizontal: 14, paddingVertical: Platform.OS === "ios" ? 12 : 8, gap: 10, marginBottom: 12 },
  searchInput: { flex: 1, color: "#E0E0E0", fontSize: 14, padding: 0 },
  tabBar: { flexDirection: "row", gap: 6, marginBottom: 12 },
  tabItem: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 4, borderWidth: 1, borderColor: "#333", backgroundColor: "rgba(26,26,26,0.5)" },
  tabItemActive: { borderColor: "rgba(75,83,32,0.6)", backgroundColor: "rgba(75,83,32,0.15)" },
  tabText: { color: "#666", fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  tabTextActive: { color: "#4B5320" },
  tabCount: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.05)" },
  tabCountActive: { backgroundColor: "rgba(75,83,32,0.25)" },
  tabCountText: { color: "#555", fontSize: 9, fontWeight: "800" },
  tabCountTextActive: { color: "#5C6B2A" },
  contentArea: { flex: 1 },
  commandFrame: { flex: 1, backgroundColor: "rgba(26,26,26,0.35)", borderWidth: 1, borderColor: CBR, borderRadius: 8, overflow: "hidden", padding: 6 },
  splitHeader: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 8 },
  splitHeaderText: { fontSize: 10, fontWeight: "800", letterSpacing: 3 },
  splitHeaderCount: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.06)" },
  splitHeaderCountText: { color: "#666", fontSize: 9, fontWeight: "800" },
  splitDivider: { height: 1, backgroundColor: "rgba(75,83,32,0.5)", marginVertical: 4, marginHorizontal: 8 },
  listContent: { paddingBottom: 8, gap: 6 },
  scrollFlex: { flex: 1 },
  inactiveContent: { paddingBottom: 8 },
  memberCard: { flexDirection: "row", alignItems: "center", backgroundColor: CB, borderWidth: 1, borderColor: CBR, borderRadius: 8, paddingVertical: 14, paddingHorizontal: 14, marginBottom: 6, overflow: "hidden" },
  leftStripe: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3, borderTopLeftRadius: 8, borderBottomLeftRadius: 8 },
  avatar: { width: AVATAR_LIST_SIZE, height: AVATAR_LIST_SIZE, borderRadius: AVATAR_LIST_SIZE / 2, backgroundColor: "rgba(75,83,32,0.12)", borderWidth: 1.5, borderColor: "#333", alignItems: "center", justifyContent: "center" },
  avatarImg: { width: AVATAR_LIST_SIZE, height: AVATAR_LIST_SIZE, borderRadius: AVATAR_LIST_SIZE / 2, borderWidth: 1.5, borderColor: "#333" },
  avatarInitials: { color: "#5C6B2A", fontSize: 14, fontWeight: "900", letterSpacing: 1 },
  cardInfo: { flex: 1, marginLeft: 12, gap: 4 },
  memberName: { color: "#E0E0E0", fontSize: 14, fontWeight: "700", letterSpacing: 0.3 },
  memberMeta: { color: "#555", fontSize: 10, letterSpacing: 0.5 },
  statusBarWrap: { paddingHorizontal: 8, justifyContent: "center" },
  statusBar: { width: 22, height: 4, borderRadius: 2 },
  statusTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 3, borderWidth: 1 },
  statusTagText: { fontSize: 8, fontWeight: "800", letterSpacing: 2 },
  emptyHint: { color: "#444", fontSize: 12, textAlign: "center", paddingVertical: 24, letterSpacing: 1 },
  sectionDivider: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10, marginTop: 4 },
  sectionLine: { flex: 1, height: 1, backgroundColor: "#333" },
  sectionLabelWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionLabel: { color: "#D4A017", fontSize: 9, fontWeight: "700", letterSpacing: 2 },
  footer: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  footerLine: { flex: 1, height: 1, backgroundColor: "#1E1E1E" },
  footerText: { color: "#2A2A2A", fontSize: 8, fontWeight: "600", letterSpacing: 3 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", alignItems: "center", paddingHorizontal: 20 },
  modalBox: { width: "100%", maxWidth: 400, maxHeight: "80%", backgroundColor: "#1A1A1A", borderRadius: 6, borderWidth: 1, borderColor: "#4B5320", paddingVertical: 22, paddingHorizontal: 18, shadowColor: "#4B5320", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 15 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  modalHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  modalHeaderRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  modalTitle: { color: "#E0E0E0", fontSize: 14, fontWeight: "800", letterSpacing: 2 },
  modalCloseBtn: { padding: 4, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.05)" },
  editToggleBtn: { padding: 6, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "#333" },
  editToggleBtnActive: { backgroundColor: "rgba(75,83,32,0.4)", borderColor: "#5C6B2A" },
  lockedHint: { fontSize: 10, marginLeft: 4 },
  modalSep: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  modalSepLine: { flex: 1, height: 1, backgroundColor: "#333" },
  dossierNameBox: { alignItems: "center", paddingVertical: 14, marginBottom: 18, borderRadius: 4, backgroundColor: "rgba(0,0,0,0.4)", borderWidth: 1, borderColor: "#2A2A2A" },
  dossierName: { color: "#E0E0E0", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  formGroup: { marginBottom: 14 },
  formLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  formLabel: { color: "#888", fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  dateBtn: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#111", borderWidth: 1, borderColor: "#333", borderRadius: 4, paddingHorizontal: 14, paddingVertical: 12 },
  dateBtnText: { color: "#E0E0E0", fontSize: 14, fontWeight: "600", letterSpacing: 1 },
  freezeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 4, backgroundColor: "rgba(0,0,0,0.3)", borderWidth: 1, borderColor: "#2A2A2A" },
  freezeInputWrap: { flexDirection: "row", alignItems: "center", gap: 12 },
  freezeBtn: { width: 32, height: 32, borderRadius: 6, backgroundColor: "#1E1E1E", borderWidth: 1, borderColor: "#333", alignItems: "center", justifyContent: "center" },
  freezeBtnText: { color: "#E0E0E0", fontSize: 18, fontWeight: "600" },
  freezeValue: { color: "#E0E0E0", fontSize: 20, fontWeight: "900", letterSpacing: 2, minWidth: 28, textAlign: "center" },

  // ═══════════ FREEZE DAYS PANEL ═══════════
  freezePanel: { backgroundColor: "rgba(93,173,226,0.08)", borderWidth: 1, borderColor: "rgba(93,173,226,0.3)", borderRadius: 6, padding: 16, marginBottom: 6, gap: 12 },
  freezePanelTitle: { color: "#5DADE2", fontSize: 10, fontWeight: "800", letterSpacing: 3, textAlign: "center" },
  freezePanelRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
  freezeDayBtn: { width: 36, height: 36, borderRadius: 6, backgroundColor: "rgba(93,173,226,0.15)", borderWidth: 1, borderColor: "rgba(93,173,226,0.3)", alignItems: "center", justifyContent: "center" },
  freezeDayInput: { width: 60, height: 40, borderRadius: 4, backgroundColor: "#111", borderWidth: 1, borderColor: "rgba(93,173,226,0.3)", color: "#E0E0E0", fontSize: 20, fontWeight: "900", textAlign: "center", padding: 0 },
  freezeDayLabel: { color: "#5DADE2", fontSize: 12, fontWeight: "700", letterSpacing: 2 },
  freezePanelHint: { color: "#666", fontSize: 9, letterSpacing: 1, textAlign: "center" },

  // ═══════════ DYNAMIC ACTION BUTTONS ═══════════
  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderWidth: 1, borderRadius: 4, paddingVertical: 14 },
  actionBtnText: { color: "#E0E0E0", fontSize: 12, fontWeight: "700", letterSpacing: 3 },

  // AKTİF ET — Haki Yeşil
  actionBtnActivate: { backgroundColor: "rgba(75,83,32,0.65)", borderColor: "#5C6B2A" },
  // DONDUR — Buz Mavisi
  actionBtnFreeze: { backgroundColor: "rgba(93,173,226,0.35)", borderColor: "rgba(93,173,226,0.6)" },
  // SİL — Koyu Kırmızı
  actionBtnDelete: { backgroundColor: "rgba(139,0,0,0.45)", borderColor: "rgba(139,0,0,0.7)" },
  // YENİLE — Yeşil
  actionBtnRenew: { backgroundColor: "rgba(75,83,32,0.65)", borderColor: "#5C6B2A" },
  // Yan yana satır
  actionBtnRow: { flexDirection: "row", gap: 10 },

  cancelBtn: { alignItems: "center", paddingVertical: 12, marginTop: 6 },
  cancelText: { color: "#666", fontSize: 11, fontWeight: "600", letterSpacing: 3 },
});
