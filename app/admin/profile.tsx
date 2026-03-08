import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Modal, Pressable, Image
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LogOut, Users, Activity, User, Ticket, ShieldCheck, Mail, X, Edit3, AlertCircle, Camera } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { decode } from "base64-arraybuffer";
import { supabase } from "@/lib/supabase";
import { useAlert } from "@/components/CustomAlert";
import { useRouter } from "expo-router";
import TacticalInput from "@/components/TacticalInput";
import TacticalButton from "@/components/TacticalButton";

const CB = "rgba(26,26,26,0.35)";
const CBR = "#333";
const AVATAR_SIZE = 120;

// ═══════════ AVATAR HELPER ═══════════
function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export default function AdminProfileScreen() {
  const router = useRouter();
  const { showAlert } = useAlert();
  const [adminEmail, setAdminEmail] = useState("admin@barikat.com");
  const [adminName, setAdminName] = useState("Yönetici");
  const [adminAvatarUrl, setAdminAvatarUrl] = useState<string | null>(null);
  const [adminUserId, setAdminUserId] = useState<string | null>(null);

  // Real stats from DB
  const [totalMembers, setTotalMembers] = useState(0);
  const [activeToday, setActiveToday] = useState(0);
  const [generatingCode, setGeneratingCode] = useState(false);

  // Edit Profile State
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // ═══════════ AVATAR STATE ═══════════
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user?.email) setAdminEmail(data.user.email);
      if (data.user?.id) setAdminUserId(data.user.id);
      const meta = data.user?.user_metadata;
      if (meta?.full_name) setAdminName(meta.full_name);
      else if (meta?.name) setAdminName(meta.name);
      else if (data.user?.email) setAdminName(data.user.email.split("@")[0]);

      // Fetch avatar_url from profiles table
      if (data.user?.id) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("avatar_url, full_name")
          .eq("id", data.user.id)
          .single();
        if (profileData?.avatar_url) setAdminAvatarUrl(profileData.avatar_url);
        if (profileData?.full_name) setAdminName(profileData.full_name);
      }
    });
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      // Total members
      const { count: memberCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "member");
      setTotalMembers(memberCount ?? 0);

      // Today's unique visitors (00:00 — now)
      const todayStr = new Date().toISOString().split("T")[0];
      const { data: logsData } = await supabase
        .from("gym_logs")
        .select("user_id")
        .gte("entry_time", todayStr + "T00:00:00")
        .lte("entry_time", todayStr + "T23:59:59");
      const uniqueUsers = new Set(logsData?.map(log => log.user_id));
      setActiveToday(uniqueUsers.size);
    } catch (e) {
      console.error("Stats fetch failed:", e);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleSignOut = () => {
    showAlert("ÇIKIŞ", "Oturumu kapatmak istiyor musunuz?", [
      { text: "İPTAL", style: "cancel" },
      { text: "ÇIKIŞ YAP", style: "destructive", onPress: async () => { await supabase.auth.signOut(); router.replace("/(auth)/login"); } },
    ]);
  };

  // E-posta format kontrolü
  const isValidEmail = (email: string) => {
    if (email.trim().length === 0) return true; // Boş = değiştirmeyecek
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };

  const emailError = editEmail.trim().length > 0 && !isValidEmail(editEmail);
  const canSave = editName.trim().length > 0 && !emailError;

  const openEditModal = () => {
    setEditName(adminName);
    setEditEmail("");
    setAvatarPreview(null);
    setAvatarBase64(null);
    setIsEditModalVisible(true);
  };

  // ═══════════ AVATAR: IMAGE PICKER ═══════════

  const pickAvatar = async () => {
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
    }
  };

  // ═══════════ AVATAR: SUPABASE STORAGE UPLOAD ═══════════

  const uploadAvatar = async (): Promise<string | null> => {
    if (!avatarBase64 || !adminUserId) return null;

    setAvatarUploading(true);
    try {
      const fileName = `${adminUserId}_${Date.now()}.jpg`;

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

      if (editEmail.trim().length > 0 && !isValidEmail(editEmail)) {
        showAlert("HATA", "Geçersiz e-posta formatı.");
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
      const { data: nameData, error: nameError } = await supabase.auth.updateUser(nameUpdate);
      if (nameError) throw nameError;

      if (nameData.user) {
        const profileUpdate: Record<string, string> = { full_name: editName.trim() };
        if (newAvatarUrl) {
          profileUpdate.avatar_url = newAvatarUrl;
        }
        await supabase.from("profiles").update(profileUpdate).eq("id", nameData.user.id);
        setAdminName(editName.trim());
        if (newAvatarUrl) {
          setAdminAvatarUrl(newAvatarUrl);
        }
      }

      // 3) E-posta güncelleme (kullanıcı yeni mail yazdıysa)
      if (editEmail.trim().length > 0 && editEmail.trim() !== adminEmail) {
        const { error: emailError } = await supabase.auth.updateUser({ email: editEmail.trim() });
        if (emailError) throw emailError;

        setIsEditModalVisible(false);
        setAvatarPreview(null);
        showAlert(
          "GÜVENLİK ONAYI GEREKİYOR",
          "Güvenlik onayı gereklidir!\n\nHem mevcut (eski) e-posta adresinize hem de yeni adresinize onay linkleri gönderildi.\n\nLütfen gelen kutularınızı kontrol edin.",
          [{ text: "ANLAŞILDI" }]
        );
      } else {
        setIsEditModalVisible(false);
        setAvatarPreview(null);
        showAlert("BAŞARILI", "Profil bilgileriniz güncellendi.", [{ text: "TAMAM" }]);
      }
    } catch (e: any) {
      showAlert("HATA", e.message || "Güncelleme başarısız.");
    } finally {
      setEditLoading(false);
    }
  };

  // ═══════════ INVITE CODE GENERATION ═══════════
  const generateInviteCode = async () => {
    setGeneratingCode(true);
    try {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I confusion
      let suffix = "";
      for (let i = 0; i < 5; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
      const code = `BRKT-${suffix}`;

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { showAlert("HATA", "Oturum bilgisi alınamadı."); return; }

      const { error } = await supabase.from("admin_invites").insert({
        code,
        created_by: userData.user.id,
        is_used: false,
      });

      if (error) {
        console.error("Invite code error:", error);
        showAlert("HATA", `Kod oluşturulamadı: ${error.message}`);
        return;
      }

      showAlert(
        "KOD ÜRETİLDİ",
        `Yeni antrenör davet kodu:\n\n${code}\n\nBu kodu yeni antrenöre verin. Kod tek kullanımlıktır.`,
        [{ text: "TAMAM" }]
      );
    } catch (e: any) {
      showAlert("HATA", e?.message || "Beklenmeyen hata oluştu.");
    } finally {
      setGeneratingCode(false);
    }
  };

  // ═══════════ AVATAR DISPLAY HELPERS ═══════════

  const currentAvatarUrl = avatarPreview || adminAvatarUrl || null;
  const initials = getInitials(adminName);

  const renderCardAvatar = (size: number) => {
    if (adminAvatarUrl) {
      return (
        <Image
          source={{ uri: adminAvatarUrl }}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: 2,
            borderColor: "#4B5320",
          }}
        />
      );
    }

    return (
      <View style={st.idAvatarBg}>
        {size >= 80 ? (
          <Text style={{ color: "#4B5320", fontSize: size * 0.32, fontWeight: "900", letterSpacing: 2 }}>
            {initials}
          </Text>
        ) : (
          <User size={size * 0.45} color="#4B5320" />
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={st.safeArea} edges={["top"]}>
      <ScrollView style={st.scroll} contentContainerStyle={st.container} showsVerticalScrollIndicator={false}>
        {/* HEADER */}
        <View style={st.header}>
          <View style={st.headerLeft}>
            <View style={st.badge}><User size={20} color="#4B5320" /></View>
            <Text style={st.headerTitle}>PROFİL</Text>
          </View>
        </View>

        {/* TACTICAL IDENTITY CARD */}
        <View style={st.idCard}>
          {/* Top highlight bar */}
          <View style={st.idAccent} />
          
          <View style={st.idCardInner}>
            {/* Left side: Avatar */}
            <View style={st.idAvatarWrap}>
              {renderCardAvatar(68)}
              {/* Online indicator dot */}
              <View style={st.idOnlineDot} />
            </View>

            {/* Right side: Info */}
            <View style={st.idInfoWrap}>
              <View style={st.idHeaderRow}>
                <View style={st.idRoleRow}>
                  <Text style={st.roleText}>YÖNETİCİ</Text>
                </View>
                <TouchableOpacity onPress={openEditModal} style={st.editProfileBtn} activeOpacity={0.7}>
                  <Edit3 size={14} color="#A0A0A0" />
                </TouchableOpacity>
              </View>
              
              <Text style={st.adminName} numberOfLines={1}>{adminName}</Text>
              
              <View style={st.idEmailRow}>
                <Mail size={12} color="#666" />
                <Text style={st.adminEmail} numberOfLines={1}>{adminEmail}</Text>
              </View>
            </View>
          </View>
          

        </View>

        {/* STATS */}
        <View style={st.statsSection}>
          <View style={st.sepRow}><View style={st.sepLine} /><Text style={st.sepLabel}>İSTATİSTİKLER</Text><View style={st.sepLine} /></View>
          <View style={st.statsGrid}>
            <View style={st.statCard}>
              <View style={[st.statIcon, { backgroundColor: "rgba(75,83,32,0.2)" }]}><Users size={18} color="#4B5320" /></View>
              <Text style={st.statValue}>{totalMembers}</Text>
              <Text style={st.statLabel}>TOPLAM ÜYE</Text>
            </View>
            <View style={st.statCard}>
              <View style={[st.statIcon, { backgroundColor: "rgba(92,107,42,0.2)" }]}><Activity size={18} color="#5C6B2A" /></View>
              <Text style={st.statValue}>{activeToday}</Text>
              <Text style={st.statLabel}>BUGÜN GİRENLER</Text>
            </View>
          </View>
        </View>

        {/* INVITE CODE */}
        <View style={st.inviteSection}>
          <View style={st.sepRow}><View style={st.sepLine} /><Text style={st.sepLabel}>ANTRENÖR DAVETİ</Text><View style={st.sepLine} /></View>
          <TouchableOpacity onPress={generateInviteCode} style={st.inviteBtn} activeOpacity={0.7} disabled={generatingCode}>
            {generatingCode ? <ActivityIndicator color="#E0E0E0" size="small" /> : <Ticket size={18} color="#4B5320" />}
            <Text style={st.inviteBtnText}>{generatingCode ? "ÜRETİLİYOR..." : "YENİ DAVET KODU ÜRET"}</Text>
          </TouchableOpacity>
          <Text style={st.inviteHint}>Tek kullanımlık BRKT-XXXXX formatında kod üretir.</Text>
        </View>

        {/* LOGOUT */}
        <View style={st.logoutSection}>
          <TouchableOpacity onPress={handleSignOut} style={st.logoutBtn} activeOpacity={0.7}>
            <LogOut size={20} color="#C0392B" />
            <Text style={st.logoutText}>SİSTEMDEN ÇIK</Text>
          </TouchableOpacity>
          <Text style={st.logoutHint}>Oturum kapatıldığında giriş ekranına yönlendirilirsiniz.</Text>
        </View>
      </ScrollView>

      <View style={st.footer}>
        <View style={st.fLine} />
        <Text style={st.fText}>BARİKAT • YÖNETİM</Text>
        <View style={st.fLine} />
      </View>

      {/* ═══════════ EDIT PROFILE MODAL (WITH AVATAR) ═══════════ */}
      <Modal visible={isEditModalVisible} transparent animationType="fade" onRequestClose={() => setIsEditModalVisible(false)}>
        <Pressable style={st.modalOverlay} onPress={() => !editLoading && setIsEditModalVisible(false)}>
          <Pressable style={st.modalBox} onPress={() => {}}>
            {/* Header */}
            <View style={st.modalHeader}>
               <View style={st.modalHeaderLeft}>
                 <Edit3 size={18} color="#4B5320" />
                 <Text style={st.modalTitle}>BİLGİLERİ DÜZENLE</Text>
               </View>
               <TouchableOpacity onPress={() => !editLoading && setIsEditModalVisible(false)} style={st.modalCloseBtn}><X size={16} color="#666" /></TouchableOpacity>
            </View>

            {/* ═══ AVATAR SECTION ═══ */}
            <View style={st.avatarSection}>
              <TouchableOpacity
                onPress={pickAvatar}
                activeOpacity={0.7}
                disabled={editLoading}
                style={st.avatarTouchable}
              >
                {/* Avatar Circle */}
                <View style={st.avatarOuterRing}>
                  {avatarUploading ? (
                    <View style={st.avatarUploadingOverlay}>
                      <ActivityIndicator size="large" color="#4B5320" />
                    </View>
                  ) : currentAvatarUrl ? (
                    <Image
                      source={{ uri: currentAvatarUrl }}
                      style={st.avatarImage}
                    />
                  ) : (
                    <View style={st.avatarPlaceholder}>
                      <Text style={st.avatarInitials}>{initials}</Text>
                    </View>
                  )}

                  {/* Camera Badge */}
                  <View style={st.cameraBadge}>
                    <Camera size={14} color="#E0E0E0" />
                  </View>
                </View>
              </TouchableOpacity>
              <Text style={st.avatarHint}>FOTOĞRAF YÜKLE</Text>
            </View>

            {/* Separator */}
            <View style={st.modalSep}><View style={st.modalSepLine} /><User size={12} color="#4B5320" /><View style={st.modalSepLine} /></View>
            
            {/* Form Fields */}
            <View style={{ marginBottom: 16 }}>
              <TacticalInput
                label="Ad Soyad"
                placeholder="Adınız Soyadınız"
                value={editName}
                onChangeText={setEditName}
                icon={<User size={18} color="#555" />}
              />
              <TacticalInput
                label="Yeni E-Posta (İsteğe Bağlı)"
                placeholder="Değiştirmek istemiyorsanız boş bırakın"
                value={editEmail}
                onChangeText={setEditEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                icon={<Mail size={18} color="#555" />}
              />
              {emailError && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4, paddingHorizontal: 4 }}>
                  <AlertCircle size={12} color="#E74C3C" />
                  <Text style={{ color: "#E74C3C", fontSize: 10, fontWeight: "600", letterSpacing: 1 }}>Geçersiz e-posta formatı</Text>
                </View>
              )}
            </View>

            {/* Save Button */}
            <TacticalButton
               title={avatarUploading ? "YÜKLENIYOR..." : "BİLGİLERİ KAYDET"}
               onPress={handleUpdateProfile}
               loading={editLoading}
               disabled={!canSave || avatarUploading}
               icon={<ShieldCheck size={18} color="#E0E0E0" />}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "transparent" },
  scroll: { flex: 1 },
  container: { paddingHorizontal: 16, paddingBottom: 20 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 4, paddingBottom: 16 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  badge: { width: 42, height: 42, borderRadius: 8, backgroundColor: CB, borderWidth: 1, borderColor: CBR, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#E0E0E0", fontSize: 16, fontWeight: "900", letterSpacing: 4 },
  headerEditBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(75,83,32,0.2)", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: "rgba(75,83,32,0.5)" },
  headerEditTxt: { color: "#E0E0E0", fontSize: 10, fontWeight: "800", letterSpacing: 2 },

  idCard: { backgroundColor: "rgba(26,26,26,0.6)", borderWidth: 1, borderColor: "#333", borderRadius: 10, overflow: "hidden", marginBottom: 24, elevation: 5, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6 },
  idAccent: { height: 4, backgroundColor: "#4B5320", width: "100%" },
  idCardInner: { flexDirection: "row", alignItems: "center", padding: 20, gap: 20 },
  idAvatarWrap: { position: "relative" },
  idAvatarBg: { width: 68, height: 68, borderRadius: 34, backgroundColor: "rgba(75,83,32,0.15)", borderWidth: 2, borderColor: "#4B5320", alignItems: "center", justifyContent: "center" },
  idOnlineDot: { position: "absolute", bottom: 2, right: 2, width: 14, height: 14, borderRadius: 7, backgroundColor: "#5C6B2A", borderWidth: 2, borderColor: "#1A1A1A" },
  idInfoWrap: { flex: 1, justifyContent: "center", gap: 4 },
  idHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 2 },
  idRoleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  roleText: { color: "#4B5320", fontSize: 10, fontWeight: "800", letterSpacing: 3 },
  editProfileBtn: { padding: 8, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "#333" },
  adminName: { color: "#E0E0E0", fontSize: 24, fontWeight: "900", letterSpacing: 1 },
  idEmailRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  adminEmail: { color: "#888", fontSize: 13, fontWeight: "500", letterSpacing: 0.5 },


  statsSection: { marginBottom: 28 },
  sepRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  sepLine: { flex: 1, height: 1, backgroundColor: "#333" },
  sepLabel: { color: "#555", fontSize: 9, fontWeight: "700", letterSpacing: 3 },
  statsGrid: { flexDirection: "row", gap: 10, marginBottom: 10 },
  statCard: { flex: 1, backgroundColor: CB, borderWidth: 1, borderColor: CBR, borderRadius: 8, paddingVertical: 18, paddingHorizontal: 14, alignItems: "center", gap: 8 },
  statIcon: { width: 38, height: 38, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  statValue: { color: "#E0E0E0", fontSize: 28, fontWeight: "900", letterSpacing: 1 },
  statLabel: { color: "#666", fontSize: 8, fontWeight: "700", letterSpacing: 2 },


  logoutSection: { marginBottom: 24 },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, paddingVertical: 18, borderRadius: 6, backgroundColor: "rgba(139,0,0,0.12)", borderWidth: 1.5, borderColor: "rgba(139,0,0,0.4)" },
  logoutText: { color: "#C0392B", fontSize: 14, fontWeight: "800", letterSpacing: 4 },
  logoutHint: { color: "#444", fontSize: 10, textAlign: "center", marginTop: 10, letterSpacing: 0.5 },

  inviteSection: { marginBottom: 28 },
  inviteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, paddingVertical: 16, borderRadius: 6, backgroundColor: "rgba(75,83,32,0.15)", borderWidth: 1.5, borderColor: "rgba(75,83,32,0.5)" },
  inviteBtnText: { color: "#E0E0E0", fontSize: 12, fontWeight: "800", letterSpacing: 3 },
  inviteHint: { color: "#444", fontSize: 10, textAlign: "center", marginTop: 10, letterSpacing: 0.5 },

  footer: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 16, marginTop: "auto" },
  fLine: { flex: 1, height: 1, backgroundColor: "#1E1E1E" },
  fText: { color: "#2A2A2A", fontSize: 8, fontWeight: "600", letterSpacing: 3 },

  // ═══════════ EDIT MODAL ═══════════
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", alignItems: "center", paddingHorizontal: 20 },
  modalBox: { width: "100%", maxWidth: 400, backgroundColor: "#1A1A1A", borderRadius: 8, borderWidth: 1, borderColor: "#333", paddingVertical: 24, paddingHorizontal: 20 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  modalTitle: { color: "#E0E0E0", fontSize: 14, fontWeight: "800", letterSpacing: 3 },
  modalCloseBtn: { padding: 4, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.05)" },
  modalSep: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 },
  modalSepLine: { flex: 1, height: 1, backgroundColor: "#333" },

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
  avatarHint: {
    color: "#666",
    fontSize: 9,
    letterSpacing: 3,
    fontWeight: "700",
    marginTop: 10,
    textTransform: "uppercase",
  },
});
