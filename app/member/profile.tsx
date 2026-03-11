import React, { useState, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  Image,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAlert } from "@/components/CustomAlert";
import {
  User,
  Calendar,
  Clock,
  LogOut,
  Activity,
  ChevronRight,
  X,
  FileText,
  Edit3,
  ShieldCheck,
  Mail,
  ChevronDown,
  AlertCircle,
  Camera,
  Trash2,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { decode } from "base64-arraybuffer";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import type { Profile, GymLog } from "@/lib/types";
import TacticalButton from "@/components/TacticalButton";
import TacticalInput from "@/components/TacticalInput";
import { calculateMembershipStatus } from "@/utils/dateHelpers";

const PREVIEW_COUNT = 3;
const AVATAR_SIZE = 120;

// ═══════════ AVATAR HELPER ═══════════
function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { showAlert } = useAlert();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recentLogs, setRecentLogs] = useState<GymLog[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [allLogs, setAllLogs] = useState<GymLog[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);

  // ═══════════ EDIT PROFILE STATE ═══════════
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editName, setEditName] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // ═══════════ EMAIL CHANGE STATE ═══════════
  const [emailChangeStep, setEmailChangeStep] = useState<0 | 1 | 2 | 3>(0);
  const [newEmail, setNewEmail] = useState("");
  const [oldEmailOtp, setOldEmailOtp] = useState("");
  const [newEmailOtp, setNewEmailOtp] = useState("");
  const [emailChangeLoading, setEmailChangeLoading] = useState(false);

  // ═══════════ AVATAR STATE ═══════════
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [removeAvatar, setRemoveAvatar] = useState(false);

  // ═══════════ HISTORY FILTER STATE ═══════════
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null); // null = All
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const months = ["TÜMÜ", "OCAK", "ŞUBAT", "MART", "NİSAN", "MAYIS", "HAZİRAN", "TEMMUZ", "AĞUSTOS", "EYLÜL", "EKİM", "KASIM", "ARALIK"];

  // ═══════════ DATA FETCHERS ═══════════

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

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const openFullHistory = async () => {
    setHistoryModalVisible(true);
    setSelectedMonth(null);
    await fetchAllLogs();
  };

  const openEditModal = () => {
    setEditName(profile?.full_name || "");
    setEmailChangeStep(0);
    setNewEmail("");
    setOldEmailOtp("");
    setNewEmailOtp("");
    setAvatarPreview(null);
    setAvatarBase64(null);
    setRemoveAvatar(false);
    setIsEditModalVisible(true);
  };

  // ═══════════ AVATAR: IMAGE PICKER ═══════════

  const pickAvatar = async () => {
    // İzin kontrolü
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      showAlert(
        "İZİN GEREKLİ",
        "Fotoğraf seçebilmek için galeri erişimine izin vermeniz gerekmektedir.",
        [{ text: "TAMAM" }]
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.4,
      base64: true,
    });

    if (!result.canceled && result.assets.length > 0) {
      setAvatarPreview(result.assets[0].uri);
      setAvatarBase64(result.assets[0].base64 ?? null);
      setRemoveAvatar(false);
    }
  };

  // ═══════════ AVATAR: SUPABASE STORAGE UPLOAD ═══════════

  const uploadAvatar = async (): Promise<string | null> => {
    if (!avatarBase64 || !user) return null;

    setAvatarUploading(true);
    try {
      const fileName = `${user.id}_${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, decode(avatarBase64), {
          contentType: "image/jpeg",
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw uploadError;
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      return publicUrlData.publicUrl;
    } catch (err) {
      console.error("Avatar upload failed:", err);
      return null;
    } finally {
      setAvatarUploading(false);
    }
  };

  // ═══════════ KAYDET ═══════════

  const handleUpdateProfile = async () => {
    setEditLoading(true);
    try {
      if (editName.trim().length === 0) {
        showAlert("HATA", "Ad soyad boş bırakılamaz.");
        setEditLoading(false);
        return;
      }

      // 1) Avatar yükleme (varsa)
      let newAvatarUrl: string | null = null;
      if (avatarPreview) {
        newAvatarUrl = await uploadAvatar();
        if (!newAvatarUrl) {
          showAlert("HATA", "Fotoğraf yüklenemedi. Lütfen tekrar deneyin.");
          setEditLoading(false);
          return;
        }
      }

      // 2) İsim güncelleme
      const nameUpdate: any = { data: { full_name: editName.trim() } };
      const { data, error } = await supabase.auth.updateUser(nameUpdate);
      if (error) throw error;

      if (data.user) {
        const profileUpdate: Record<string, string | null> = { full_name: editName.trim() };
        if (newAvatarUrl) {
          profileUpdate.avatar_url = newAvatarUrl;
        } else if (removeAvatar) {
          profileUpdate.avatar_url = null;
        }
        await supabase.from("profiles").update(profileUpdate).eq("id", data.user.id);
        // @ts-ignore
        setProfile(prev => prev ? { ...prev, ...profileUpdate } : prev);
      }

      setIsEditModalVisible(false);
      setAvatarPreview(null);
      showAlert("BAŞARILI", "Profil bilgileriniz güncellendi.", [{ text: "TAMAM" }]);
    } catch (e: any) {
      showAlert("HATA", e.message || "Güncelleme başarısız.");
    } finally {
      setEditLoading(false);
    }
  };

  const handleRequestEmailChange = async () => {
    if (!newEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim())) {
      showAlert("HATA", "Geçerli bir e-posta adresi girin.");
      return;
    }
    setEmailChangeLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
      if (error) throw error;
      
      showAlert("BİLGİ", "Mevcut (eski) e-posta adresinize bir güvenlik kodu gönderdik.");
      setEmailChangeStep(2);
    } catch (e: any) {
      showAlert("HATA", e.message || "E-posta güncelleme isteği başarısız oldu.");
    } finally {
      setEmailChangeLoading(false);
    }
  };

  const handleVerifyOldEmail = async () => {
    if (!oldEmailOtp.trim() || oldEmailOtp.length !== 6) {
      showAlert("HATA", "Lütfen 6 haneli kodu girin.");
      return;
    }
    if (!user?.email) return;

    setEmailChangeLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: user.email,
        token: oldEmailOtp.trim(),
        type: 'email_change'
      });
      if (error) throw error;
      
      showAlert("BAŞARILI", "Yeni e-posta adresinize gönderilen onay kodunu girin.");
      setEmailChangeStep(3);
    } catch (e: any) {
      showAlert("HATA", e.message || "Doğrulama başarısız. Girdiğiniz kodu kontrol edin.");
    } finally {
      setEmailChangeLoading(false);
    }
  };

  const handleVerifyNewEmail = async () => {
    if (!newEmailOtp.trim() || newEmailOtp.length !== 6) {
      showAlert("HATA", "Lütfen 6 haneli kodu girin.");
      return;
    }
    setEmailChangeLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: newEmail.trim(),
        token: newEmailOtp.trim(),
        type: 'email_change'
      });
      if (error) throw error;
      
      setEmailChangeStep(0);
      showAlert("BAŞARILI", "E-posta adresiniz başarıyla güncellendi.");
    } catch (e: any) {
      showAlert("HATA", e.message || "Doğrulama başarısız. Girdiğiniz kodu kontrol edin.");
    } finally {
      setEmailChangeLoading(false);
    }
  };

  // ═══════════ SIGN OUT ═══════════

  const handleSignOut = () => {
    showAlert(
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
              showAlert("HATA", msg);
            } finally {
              setLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  // ═══════════ FORMATTERS ═══════════

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

  const formatDateDMY = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  };

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    });

  const formatDuration = (entry: string, exit: string | null) => {
    if (!exit) return "Devam ediyor";
    const diff = new Date(exit).getTime() - new Date(entry).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}s ${minutes}dk`;
  };

  // ═══════════ MEMBER TIER CALCULATION ═══════════
  const membershipData = calculateMembershipStatus(
    profile?.membership_end,
    profile?.status || "inactive"
  );
  const daysLeft = profile?.membership_end ? membershipData.daysLeft : null;

  // ═══════════ AVATAR DISPLAY HELPERS ═══════════

  const currentAvatarUrl = removeAvatar ? null : (avatarPreview || profile?.avatar_url || null);
  const initials = getInitials(profile?.full_name || "");

  // Status-based colors
  const getStatusColor = () => {
    if (membershipData.status === "frozen") return "#5DADE2";
    if (membershipData.status === "inactive" || membershipData.status === "pending") return "#808080";
    if (membershipData.isExpired) return "#8B0000";
    return "#4B5320";
  };
  const statusColor = getStatusColor();

  // ═══════════ LOG CARD RENDERER ═══════════

  const renderLogItem = (log: GymLog) => (
    <View key={log.id} style={s.logItem}>
      <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
        <View
          style={[
            s.logDot,
            { backgroundColor: log.status === "inside" ? "#4B5320" : "#555" },
          ]}
        />
        <View>
          <Text style={s.logDate}>{formatDate(log.entry_time)}</Text>
          <Text style={s.logTime}>
            {formatTime(log.entry_time)}
            {log.exit_time && ` → ${formatTime(log.exit_time)}`}
          </Text>
        </View>
      </View>
      <Text
        style={[
          s.logStatus,
          { color: log.status === "inside" ? "#4B5320" : "#666" },
        ]}
      >
        {log.status === "inside"
          ? "İÇERİDE"
          : formatDuration(log.entry_time, log.exit_time)}
      </Text>
    </View>
  );

  const previewLogs = recentLogs.slice(0, PREVIEW_COUNT);

  // ═══════════ AVATAR COMPONENT ═══════════

  const renderAvatar = (size: number, inCard = false) => {
    const url = inCard ? (profile?.avatar_url || null) : currentAvatarUrl;
    const borderColor = inCard ? statusColor : "#4B5320";
    const bgColor = inCard
      ? (membershipData.status === "frozen" ? "rgba(93,173,226,0.1)" :
         membershipData.status === "inactive" || membershipData.status === "pending" ? "rgba(128,128,128,0.1)" :
         membershipData.isExpired ? "rgba(139,0,0,0.1)" :
         "rgba(75,83,32,0.15)")
      : "rgba(75,83,32,0.15)";

    if (url) {
      return (
        <Image
          source={{ uri: url }}
          style={[
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: 2,
              borderColor,
            },
          ]}
        />
      );
    }

    // Initials fallback
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bgColor,
          borderWidth: 2,
          borderColor,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {size >= 80 ? (
          <Text
            style={{
              color: borderColor,
              fontSize: size * 0.32,
              fontWeight: "900",
              letterSpacing: 2,
            }}
          >
            {initials}
          </Text>
        ) : (
          <User size={size * 0.45} color={borderColor} />
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safeArea} edges={["top", "left", "right"]}>
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
        {/* ═══════════ TACTICAL IDENTITY CARD ═══════════ */}
        <View style={s.idCard}>
          {/* Top highlight bar */}
          <View style={[s.idAccent, { backgroundColor: statusColor }]} />
          
          <View style={s.idCardInner}>
            {/* Left side: Avatar */}
            <View style={s.idAvatarWrap}>
              {renderAvatar(68, true)}
              {profile?.status === "active" && <View style={s.idOnlineDot} />}
            </View>

            {/* Right side: Info */}
            <View style={s.idInfoWrap}>
              <View style={s.idHeaderRow}>
                <View style={s.idRoleRow}>
                  <Text style={[s.roleText, { color: statusColor }]}>
                    {membershipData.status === "active" ? "AKTİF ÜYE" :
                     membershipData.status === "frozen" ? "ASKIDA" :
                     membershipData.status === "inactive" || membershipData.status === "pending" ? "ONAY BEKLİYOR" :
                     "SÜRESİ DOLMUŞ"}
                  </Text>
                </View>
                <TouchableOpacity onPress={openEditModal} style={s.editProfileBtn} activeOpacity={0.7}>
                  <Edit3 size={14} color="#A0A0A0" />
                </TouchableOpacity>
              </View>
              
              <Text style={s.profileName} numberOfLines={1}>{profile?.full_name || "Yükleniyor..."}</Text>
              
              <View style={s.idEmailRow}>
                <Mail size={12} color="#666" />
                <Text style={s.profileEmail} numberOfLines={1}>{user?.email}</Text>
              </View>
            </View>
          </View>
          
          {daysLeft !== null && (
            <View style={[
              s.idBottomBar,
              daysLeft <= 0 ? { backgroundColor: "rgba(139,0,0,0.8)" } : 
              daysLeft <= 7 ? { backgroundColor: "rgba(184,134,11,0.8)" } : 
              {}
            ]}>
              <Clock size={16} color="#FFF" />
              <Text style={s.idPassText}>
                {daysLeft > 0 ? `KALAN SÜRE: ${daysLeft} GÜN` : "ÜYELİK SÜRESİ DOLDU"}
              </Text>
            </View>
          )}
        </View>

        {/* ═══════════ READ-ONLY MEMBERSHIP INFO ═══════════ */}
        <View style={s.section}>
          <View style={s.sectionDivider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerLabel}>Üyelik Bilgileri</Text>
            <View style={s.dividerLine} />
          </View>

          <View style={s.membershipCard}>
            {/* Start Date */}
            <View style={s.dateRow}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Calendar size={14} color="#4B5320" />
                <Text style={s.dateLabel}>ÜYELİK BAŞLANGIÇ</Text>
              </View>
              <View style={s.dateValueBox}>
                <Text style={s.dateValueText}>
                  {profile?.membership_start
                    ? formatDateDMY(profile.membership_start)
                    : "—"}
                </Text>
              </View>
            </View>

            <View style={s.dateDivider} />

            {/* End Date */}
            <View style={s.dateRow}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Calendar size={14} color="#4B5320" />
                <Text style={s.dateLabel}>ÜYELİK BİTİŞ</Text>
              </View>
              <View style={s.dateValueBox}>
                <Text
                  style={[
                    s.dateValueText,
                    daysLeft !== null &&
                      daysLeft <= 0 && { color: "#8B0000" },
                  ]}
                >
                  {profile?.membership_end
                    ? formatDateDMY(profile.membership_end)
                    : "—"}
                </Text>
              </View>
            </View>

            {/* Frozen status indicator */}
            {membershipData.status === "frozen" && (
              <>
                <View style={s.dateDivider} />
                <View style={s.frozenBanner}>
                  <Clock size={14} color="#5DADE2" />
                  <Text style={s.frozenBannerText}>
                    ÜYELİĞİNİZ DONDURULMUŞTUR
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* ═══════════ RECENT ACTIVITY ═══════════ */}
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
        <View style={[s.section, { marginTop: 32 }]}>
          <TacticalButton
            title="ÇIKIŞ YAP"
            variant="danger"
            onPress={handleSignOut}
            loading={loggingOut}
            icon={<LogOut size={18} color="#E0E0E0" />}
          />
        </View>

        <View style={s.footer}>
          <Text style={s.footerText}>BARİKAT SPOR • v1.0.0</Text>
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
          <View style={s.modalHeader}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <FileText size={16} color="#4B5320" />
              <Text style={s.modalTitle}>AKTİVİTE GEÇMİŞİ</Text>
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

          <View style={{ paddingHorizontal: 24, paddingBottom: 16, zIndex: 999, elevation: 10 }}>
            <TouchableOpacity
              style={s.dropdownHeader}
              activeOpacity={0.7}
              onPress={() => setShowMonthDropdown(!showMonthDropdown)}
            >
              <Text style={s.dropdownHeaderText}>
                FİLTRE: {selectedMonth === null ? "TÜMÜ" : months[selectedMonth + 1]}
              </Text>
              <ChevronDown size={16} color="#4B5320" style={{ transform: [{ rotate: showMonthDropdown ? "180deg" : "0deg" }] }} />
            </TouchableOpacity>

            {showMonthDropdown && (
              <View style={s.dropdownListWrap}>
                <ScrollView 
                  nestedScrollEnabled 
                  style={{ maxHeight: 250 }} 
                  showsVerticalScrollIndicator={true}
                  keyboardShouldPersistTaps="handled"
                >
                  {months.map((item, index) => {
                    const monthVal = index === 0 ? null : index - 1;
                    const isSelected = selectedMonth === monthVal;
                    return (
                      <TouchableOpacity
                        key={item}
                        style={[s.dropdownItem, isSelected && s.dropdownItemActive]}
                        onPress={() => {
                          setSelectedMonth(monthVal);
                          setShowMonthDropdown(false);
                        }}
                      >
                        <Text style={[s.dropdownItemText, isSelected && s.dropdownItemTextActive]}>{item}</Text>
                        {isSelected && <View style={s.dropdownItemDot} />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>

          {loadingAll ? (
            <View style={s.modalLoadingWrap}>
              <Text style={s.modalLoadingText}>KAYITLAR YÜKLENİYOR...</Text>
            </View>
          ) : (selectedMonth === null ? allLogs : allLogs.filter(log => new Date(log.entry_time).getMonth() === selectedMonth)).length === 0 ? (
            <View style={s.modalLoadingWrap}>
              <Activity size={32} color="#555" />
              <Text style={s.modalEmptyText}>BU AY ANTRENMAN KAYDI BULUNAMADI</Text>
            </View>
          ) : (
            <FlatList
              data={selectedMonth === null ? allLogs : allLogs.filter(log => new Date(log.entry_time).getMonth() === selectedMonth)}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{
                paddingHorizontal: 24,
                paddingBottom: 40,
              }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => renderLogItem(item)}
              ListHeaderComponent={
                <Text style={s.modalCountText}>
                  Toplam {(selectedMonth === null ? allLogs : allLogs.filter(log => new Date(log.entry_time).getMonth() === selectedMonth)).length} kayıt
                </Text>
              }
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* ═══════════ EDIT PROFILE MODAL (WITH AVATAR) ═══════════ */}
      <Modal visible={isEditModalVisible} transparent animationType="fade" onRequestClose={() => setIsEditModalVisible(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => !editLoading && setIsEditModalVisible(false)}>
          <TouchableOpacity style={s.modalBox} activeOpacity={1} onPress={() => {}}>
            {/* Header */}
            <View style={s.editModalHeader}>
               <View style={s.editModalHeaderLeft}>
                 <Edit3 size={18} color="#4B5320" />
                 <Text style={s.editModalTitle}>BİLGİLERİ DÜZENLE</Text>
               </View>
               <TouchableOpacity onPress={() => !editLoading && setIsEditModalVisible(false)} style={s.editModalCloseBtn}><X size={16} color="#666" /></TouchableOpacity>
            </View>

            {/* ═══ AVATAR SECTION ═══ */}
            {emailChangeStep === 0 && (
              <View style={[s.avatarSection, { position: "relative" }]}>
                <TouchableOpacity
                  onPress={pickAvatar}
                  activeOpacity={0.7}
                  disabled={editLoading}
                  style={s.avatarTouchable}
                >
                  {/* Avatar Circle */}
                  <View style={s.avatarOuterRing}>
                    {avatarUploading ? (
                      <View style={s.avatarUploadingOverlay}>
                        <ActivityIndicator size="large" color="#4B5320" />
                      </View>
                    ) : currentAvatarUrl ? (
                      <Image
                        source={{ uri: currentAvatarUrl }}
                        style={s.avatarImage}
                      />
                    ) : (
                      <View style={s.avatarPlaceholder}>
                        <Text style={s.avatarInitials}>{initials}</Text>
                      </View>
                    )}

                    {/* Camera Badge */}
                    <View style={s.cameraBadge}>
                      <Camera size={14} color="#E0E0E0" />
                    </View>

                    {/* Trash Badge for Removal */}
                    {currentAvatarUrl && (
                      <TouchableOpacity 
                        onPress={(e) => {
                          e.stopPropagation(); // Avoid picking new photo when deleting
                          setAvatarPreview(null);
                          setAvatarBase64(null);
                          setRemoveAvatar(true);
                        }} 
                        activeOpacity={0.7}
                        disabled={editLoading}
                        style={s.trashBadge}
                      >
                        <Trash2 size={14} color="#FFF" />
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {/* Separator */}
            {emailChangeStep === 0 && (
              <View style={s.editModalSep}><View style={s.editModalSepLine} /><User size={12} color="#4B5320" /><View style={s.editModalSepLine} /></View>
            )}
            
            {/* Form Fields & Steps */}
            {emailChangeStep === 0 ? (
              <>
                <View style={{ marginBottom: 16 }}>
                  <TacticalInput
                    label="Ad Soyad"
                    placeholder="Adınız Soyadınız"
                    value={editName}
                    onChangeText={setEditName}
                    icon={<User size={18} color="#555" />}
                  />
                  <View style={{ marginTop: 12 }}>
                    <TacticalButton
                      title="E-POSTA DEĞİŞTİR"
                      onPress={() => setEmailChangeStep(1)}
                      icon={<Mail size={18} color="#E0E0E0" />}
                    />
                  </View>
                </View>

                {/* Save Button */}
                <TacticalButton
                  title={avatarUploading ? "YÜKLENİYOR..." : "BİLGİLERİ KAYDET"}
                  onPress={handleUpdateProfile}
                  loading={editLoading}
                  disabled={!editName.trim() || avatarUploading}
                  icon={<ShieldCheck size={18} color="#E0E0E0" />}
                />
              </>
            ) : emailChangeStep === 1 ? (
              <View style={{ marginBottom: 16, gap: 12 }}>
                <Text style={{ color: "#888", fontSize: 13, textAlign: "center", marginBottom: 10 }}>Yeni e-posta adresinizi girin. Güvenlik için önce mevcut adresinize doğrulama kodu gönderilecektir.</Text>
                <TacticalInput
                  label="Yeni E-Posta Adresi"
                  placeholder="yeni@barikat.com"
                  value={newEmail}
                  onChangeText={setNewEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  icon={<Mail size={18} color="#555" />}
                />
                <TacticalButton
                  title="GÜNCELLE"
                  onPress={handleRequestEmailChange}
                  loading={emailChangeLoading}
                  icon={<ShieldCheck size={18} color="#E0E0E0" />}
                />
                <TouchableOpacity onPress={() => setEmailChangeStep(0)} style={{ marginTop: 8 }} disabled={emailChangeLoading}>
                  <Text style={{ color: "#E0E0E0", textAlign: "center", fontSize: 11, fontWeight: "700", letterSpacing: 2 }}>İPTAL ET</Text>
                </TouchableOpacity>
              </View>
            ) : emailChangeStep === 2 ? (
              <View style={{ marginBottom: 16, gap: 12 }}>
                <Text style={{ color: "#888", fontSize: 13, textAlign: "center", marginBottom: 10 }}>Mevcut e-posta adresinize gönderilen 6 haneli doğrulama kodunu girin.</Text>
                <TacticalInput
                  label="Mevcut E-Postaya Gelen Kod"
                  placeholder="000000"
                  value={oldEmailOtp}
                  onChangeText={setOldEmailOtp}
                  keyboardType="number-pad"
                  maxLength={6}
                  icon={<ShieldCheck size={18} color="#555" />}
                />
                <TacticalButton
                  title="İLERİ"
                  onPress={handleVerifyOldEmail}
                  loading={emailChangeLoading}
                  icon={<ShieldCheck size={18} color="#E0E0E0" />}
                />
                <TouchableOpacity onPress={() => setEmailChangeStep(0)} style={{ marginTop: 8 }} disabled={emailChangeLoading}>
                  <Text style={{ color: "#E0E0E0", textAlign: "center", fontSize: 11, fontWeight: "700", letterSpacing: 2 }}>İPTAL ET</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ marginBottom: 16, gap: 12 }}>
                <Text style={{ color: "#888", fontSize: 13, textAlign: "center", marginBottom: 10 }}>Yeni e-posta adresinize ({newEmail}) gönderilen 6 haneli onay kodunu girin.</Text>
                <TacticalInput
                  label="Yeni E-Postaya Gelen Kod"
                  placeholder="000000"
                  value={newEmailOtp}
                  onChangeText={setNewEmailOtp}
                  keyboardType="number-pad"
                  maxLength={6}
                  icon={<ShieldCheck size={18} color="#555" />}
                />
                <TacticalButton
                  title="ONAYLA"
                  onPress={handleVerifyNewEmail}
                  loading={emailChangeLoading}
                  icon={<ShieldCheck size={18} color="#E0E0E0" />}
                />
                <TouchableOpacity onPress={() => setEmailChangeStep(0)} style={{ marginTop: 8 }} disabled={emailChangeLoading}>
                  <Text style={{ color: "#E0E0E0", textAlign: "center", fontSize: 11, fontWeight: "700", letterSpacing: 2 }}>İPTAL ET</Text>
                </TouchableOpacity>
              </View>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "transparent" },
  flex: { flex: 1 },

  // ═══════════ ID CARD ═══════════
  idCard: { backgroundColor: "rgba(26,26,26,0.5)", borderWidth: 1, borderColor: "#333", borderRadius: 10, overflow: "hidden", marginBottom: 16, marginTop: 16, elevation: 5, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, marginHorizontal: 24 },
  idAccent: { height: 4, backgroundColor: "#4B5320", width: "100%" },
  idCardInner: { flexDirection: "row", alignItems: "center", padding: 20, gap: 20 },
  idAvatarWrap: { position: "relative" },
  idOnlineDot: { position: "absolute", bottom: 2, right: 2, width: 14, height: 14, borderRadius: 7, backgroundColor: "#5C6B2A", borderWidth: 2, borderColor: "#1A1A1A" },
  idInfoWrap: { flex: 1, justifyContent: "center", gap: 4 },
  idHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 2 },
  idRoleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  roleText: { color: "#4B5320", fontSize: 10, fontWeight: "800", letterSpacing: 3 },
  profileName: { color: "#E0E0E0", fontSize: 22, fontWeight: "900", letterSpacing: 1 },
  idEmailRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  profileEmail: { color: "#888", fontSize: 12, fontWeight: "500", letterSpacing: 0.5 },
  idBottomBar: { flexDirection: "row", justifyContent: "center", alignItems: "center", backgroundColor: "rgba(75,83,32,0.8)", paddingVertical: 14, paddingHorizontal: 20, gap: 10 },
  idPassText: { color: "#FFF", fontSize: 13, fontWeight: "900", letterSpacing: 3 },
  editProfileBtn: { padding: 8, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "#333" },

  section: { paddingHorizontal: 24, marginTop: 4 },

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

  // Membership Card (Read-only)
  membershipCard: {
    backgroundColor: "rgba(26,26,26,0.65)",
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
  dateValueBox: {
    backgroundColor: "rgba(0,0,0,0.3)",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 3,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  dateValueText: {
    color: "#E0E0E0",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 1,
  },
  dateDivider: {
    height: 1,
    backgroundColor: "#333",
    marginVertical: 12,
  },
  frozenBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: 3,
    backgroundColor: "rgba(93,173,226,0.08)",
    borderWidth: 1,
    borderColor: "rgba(93,173,226,0.25)",
  },
  frozenBannerText: {
    color: "#5DADE2",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
  },

  // Activity
  emptyCard: {
    backgroundColor: "rgba(26,26,26,0.65)",
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
    backgroundColor: "rgba(26,26,26,0.65)",
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

  // ═══════════ HISTORY MODAL ═══════════
  modalSafeArea: { flex: 1, backgroundColor: "#121212" },
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

  // ═══════════ DROPDOWN ═══════════
  dropdownHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "rgba(26,26,26,0.65)", borderWidth: 1, borderColor: "#333", borderRadius: 6, paddingVertical: 14, paddingHorizontal: 16 },
  dropdownHeaderText: { color: "#E0E0E0", fontSize: 11, fontWeight: "700", letterSpacing: 3 },
  dropdownListWrap: { marginTop: 8, backgroundColor: "#1A1A1A", borderWidth: 1, borderColor: "#333", borderRadius: 6, overflow: "hidden" },
  dropdownItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#222" },
  dropdownItemActive: { backgroundColor: "rgba(75,83,32,0.15)" },
  dropdownItemText: { color: "#888", fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  dropdownItemTextActive: { color: "#4B5320" },
  dropdownItemDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#4B5320" },

  // ═══════════ EDIT MODAL ═══════════
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", alignItems: "center", paddingHorizontal: 20 },
  modalBox: { width: "100%", maxWidth: 400, backgroundColor: "#1A1A1A", borderRadius: 8, borderWidth: 1, borderColor: "#333", paddingVertical: 24, paddingHorizontal: 20 },
  editModalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  editModalHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  editModalTitle: { color: "#E0E0E0", fontSize: 14, fontWeight: "800", letterSpacing: 3 },
  editModalCloseBtn: { padding: 4, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.05)" },
  editModalSep: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 },
  editModalSepLine: { flex: 1, height: 1, backgroundColor: "#333" },

  // ═══════════ AVATAR (EDIT MODAL) ═══════════
  avatarSection: {
    alignItems: "center",
    marginBottom: 20,
  },
  avatarTouchable: {
    alignItems: "center",
  },
  avatarOuterRing: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 3,
    borderColor: "#4B5320",
  },
  avatarPlaceholder: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: "rgba(75,83,32,0.15)",
    borderWidth: 3,
    borderColor: "#4B5320",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    color: "#4B5320",
    fontSize: 38,
    fontWeight: "900",
    letterSpacing: 4,
  },
  avatarUploadingOverlay: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: "rgba(26,26,26,0.85)",
    borderWidth: 3,
    borderColor: "#4B5320",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#3D4520",
    borderWidth: 2,
    borderColor: "#1A1A1A",
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  trashBadge: {
    position: "absolute",
    bottom: 2,
    left: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#8B0000",
    borderWidth: 2,
    borderColor: "#1A1A1A",
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  avatarHint: {
    color: "#666",
    fontSize: 9,
    letterSpacing: 3,
    fontWeight: "700",
    marginTop: 10,
    textTransform: "uppercase",
  },
});
