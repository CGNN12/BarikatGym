import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Mail, Lock, User, Shield, ShieldAlert, X, KeyRound } from "lucide-react-native";
import { APP_NAME, APP_SUBTITLE } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { useRouter } from "expo-router";
import TacticalInput from "@/components/TacticalInput";
import TacticalButton from "@/components/TacticalButton";
import DeerLogo from "@/components/DeerLogo";
import { useAlert } from "@/components/CustomAlert";

// ═══════════ CONSTANTS ═══════════
const ADMIN_TAP_COUNT = 3;
const ADMIN_TAP_WINDOW_MS = 1500;

export default function LoginScreen() {
  const { signIn, signUp, loading } = useAuth();
  const router = useRouter();
  const { showAlert } = useAlert();
  const [isSignUp, setIsSignUp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<{
    fullName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  // ═══════════ INVITE CODE (hidden field) ═══════════
  const [showInviteField, setShowInviteField] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const inviteTapCount = useRef(0);
  const inviteLastTap = useRef(0);


  // 3-Tap tracking
  const tapCountRef = useRef(0);
  const lastTapTimeRef = useRef(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // ═══════════ 3-TAP PROTOCOL ═══════════
  const handleLogoTap = useCallback(() => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapTimeRef.current;

    if (timeSinceLastTap > ADMIN_TAP_WINDOW_MS) {
      // Reset — too much time passed
      tapCountRef.current = 1;
    } else {
      tapCountRef.current += 1;
    }

    lastTapTimeRef.current = now;

    // Subtle pulse feedback on each tap
    Animated.sequence([
      Animated.timing(pulseAnim, {
        toValue: 0.85,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();

    if (tapCountRef.current >= ADMIN_TAP_COUNT) {
      tapCountRef.current = 0;
      if (isSignUp) {
        // In sign-up mode: toggle invite code field
        setShowInviteField(prev => !prev);
      }
    }
  }, [pulseAnim, isSignUp]);

  // ═══════════ REGULAR LOGIN VALIDATION ═══════════
  const validate = (): boolean => {
    const newErrors: typeof errors = {};

    if (isSignUp && !fullName.trim()) {
      newErrors.fullName = "Ad Soyad gereklidir";
    }

    if (!email.trim()) {
      newErrors.email = "E-posta adresi gereklidir";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Geçerli bir e-posta giriniz";
    }

    if (!password) {
      newErrors.password = "Şifre gereklidir";
    } else if (password.length < 6) {
      newErrors.password = "Şifre en az 6 karakter olmalıdır";
    }

    if (isSignUp) {
      if (!confirmPassword) {
        newErrors.confirmPassword = "Şifre tekrarı gereklidir";
      } else if (password !== confirmPassword) {
        newErrors.confirmPassword = "Şifreler eşleşmiyor";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setErrors({});
    setIsSubmitting(true);

    try {
      if (isSignUp) {
        // ═══ INVITE CODE CHECK (if provided) ═══
        let validInvite = false;
        if (inviteCode.trim()) {
          const { data: inv, error: invErr } = await supabase
            .from("admin_invites")
            .select("id, is_used")
            .eq("code", inviteCode.trim().toUpperCase())
            .single();

          if (invErr || !inv) {
            showAlert("GE\u00c7ERS\u0130Z KOD", "Girdi\u011finiz davet kodu ge\u00e7erli de\u011fil.", [{ text: "TAMAM" }]);
            return;
          }
          if (inv.is_used) {
            showAlert("KULLANILMI\u015e KOD", "Bu davet kodu daha \u00f6nce kullan\u0131lm\u0131\u015f.", [{ text: "TAMAM" }]);
            return;
          }
          validInvite = true;
        }

        // ═══ SIGN UP ═══
        const result = await signUp(email.trim(), password, fullName.trim(), validInvite ? "admin" : "member");

        // ═══ POST-SIGNUP: mark invite code as used ═══
        if (validInvite && result?.user) {
          await supabase.from("admin_invites").update({
            is_used: true,
            used_by: result.user.id,
          }).eq("code", inviteCode.trim().toUpperCase());
        }

        showAlert(
          "KAYIT BAŞARILI",
          validInvite
            ? "Yönetici hesabınız oluşturuldu. Doğrulama bağlantısı e-posta adresinize gönderildi."
            : "Doğrulama bağlantısı e-posta adresinize gönderildi. Lütfen gelen kutunuzu kontrol ediniz.",
          [{ text: "TAMAM", onPress: () => { setIsSignUp(false); setShowInviteField(false); setInviteCode(""); } }]
        );
      } else {
        await signIn(email.trim(), password);
      }
    } catch (error: any) {
      let errorMessage = "Bir hata oluştu. Lütfen tekrar deneyin.";
      
      if (error instanceof Error) {
        if (error.message.includes("Invalid login credentials")) {
          errorMessage = "E-posta veya şifre yanlış.";
        } else {
          errorMessage = error.message;
        }
      } else if (typeof error === "string") {
        if (error.includes("Invalid login credentials")) {
          errorMessage = "E-posta veya şifre yanlış.";
        } else {
          errorMessage = error;
        }
      }

      showAlert(
        isSignUp ? "KAYIT BAŞARISIZ" : "GİRİŞ BAŞARISIZ",
        errorMessage,
        [{ text: "ANLAŞILDI", style: "cancel" }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setErrors({});
    setConfirmPassword("");
    setShowInviteField(false);
    setInviteCode("");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            {/* Header Section */}
            <View style={styles.headerSection}>
              {/* ═══ 3-TAP EASTER EGG WRAPPER ═══ */}
              <Pressable onPress={handleLogoTap} disabled={!isSignUp}>
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <DeerLogo width={180} height={200} opacity={0.3} />
                </Animated.View>
              </Pressable>

              <View style={styles.titleWrap}>
                <Text style={styles.appName}>{APP_NAME}</Text>
                <View style={styles.subtitleRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.subtitle}>{APP_SUBTITLE}</Text>
                  <View style={styles.dividerLine} />
                </View>
              </View>

              <View style={styles.secureDivider}>
                <View style={styles.secureLine} />
                <View style={styles.secureLabel}>
                  <Text style={styles.secureLabelText}>
                    {isSignUp ? "YENİ KAYIT" : "GÜVENLİ GİRİŞ"}
                  </Text>
                </View>
                <View style={styles.secureLine} />
              </View>
            </View>

            {/* Form Section */}
            <View style={styles.formSection}>
              {isSignUp && (
                <TacticalInput
                  label="Ad Soyad"
                  placeholder="Adınız Soyadınız"
                  value={fullName}
                  onChangeText={(text) => {
                    setFullName(text);
                    if (errors.fullName)
                      setErrors((e) => ({ ...e, fullName: undefined }));
                  }}
                  autoComplete="name"
                  error={errors.fullName}
                  icon={<User size={18} color="#555" />}
                />
              )}

              <TacticalInput
                label="E-Posta"
                placeholder="sporcu@barikat.com"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (errors.email)
                    setErrors((e) => ({ ...e, email: undefined }));
                }}
                keyboardType="email-address"
                autoComplete="email"
                error={errors.email}
                icon={<Mail size={18} color="#555" />}
              />

              <TacticalInput
                label="Şifre"
                placeholder="••••••••"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errors.password)
                    setErrors((e) => ({ ...e, password: undefined }));
                }}
                secureTextEntry
                error={errors.password}
                icon={<Lock size={18} color="#555" />}
              />

              {isSignUp && (
                <TacticalInput
                  label="Şifre Tekrar"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    if (errors.confirmPassword)
                      setErrors((e) => ({
                        ...e,
                        confirmPassword: undefined,
                      }));
                  }}
                  secureTextEntry
                  error={errors.confirmPassword}
                  icon={<Lock size={18} color="#555" />}
                />
              )}

              {/* Hidden invite code field (revealed by triple-tapping subtitle in sign-up mode) */}
              {isSignUp && showInviteField && (
                <TacticalInput
                  label="Antrenör Davet Kodu"
                  placeholder="BRKT-XXXXX"
                  value={inviteCode}
                  onChangeText={setInviteCode}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  icon={<KeyRound size={18} color="#4B5320" />}
                />
              )}

              {!isSignUp && (
                <View style={styles.forgotPasswordContainer}>
                  <TouchableOpacity onPress={() => router.push("/(auth)/forgot-password")} activeOpacity={0.7}>
                    <Text style={styles.forgotPasswordText}>Şifremi Unuttum</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.buttonWrap}>
                <TacticalButton
                  title={isSignUp ? "KAYIT OL" : "GİRİŞ YAP"}
                  onPress={handleSubmit}
                  loading={loading || isSubmitting}
                  disabled={isSubmitting}
                />
              </View>

              <TouchableOpacity
                onPress={toggleMode}
                style={styles.toggleButton}
                activeOpacity={0.7}
              >
                <Text style={styles.toggleText}>
                  {isSignUp
                    ? "Zaten hesabınız var mı? "
                    : "Hesabınız yok mu? "}
                </Text>
                <Text style={styles.toggleHighlight}>
                  {isSignUp ? "Giriş Yap" : "Kayıt Ol"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Footer Section */}
            <View style={styles.footerSection}>
              <View style={styles.footerDivider}>
                <View style={styles.secureLine} />
                <Text style={styles.footerText}>BARİKAT'TA HER ŞEY MÜMKÜN</Text>
                <View style={styles.secureLine} />
              </View>
              
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>


    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#121212" },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  container: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
    justifyContent: "space-between",
  },
  headerSection: { alignItems: "center" },
  titleWrap: { alignItems: "center", marginTop: 8 },
  appName: {
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 12,
    color: "#E0E0E0",
    textAlign: "center",
  },
  subtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  dividerLine: {
    height: 1,
    width: 32,
    backgroundColor: "#4B5320",
    marginHorizontal: 10,
  },
  subtitle: {
    fontSize: 11,
    letterSpacing: 6,
    color: "#4B5320",
    fontWeight: "500",
  },
  secureDivider: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginTop: 28,
    marginBottom: 8,
  },
  secureLine: { flex: 1, height: 1, backgroundColor: "#333" },
  secureLabel: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  secureLabelText: {
    color: "#555",
    fontSize: 10,
    letterSpacing: 3,
    textTransform: "uppercase",
    marginLeft: 6,
  },
  formSection: { marginTop: 20 },
  forgotPasswordContainer: { alignItems: "flex-end", marginTop: -8, marginBottom: 16, paddingRight: 4 },
  forgotPasswordText: { color: "#666", fontSize: 12, fontWeight: "600", letterSpacing: 1 },
  buttonWrap: { marginTop: 20 },
  toggleButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
    paddingVertical: 8,
  },
  toggleText: { color: "#888", fontSize: 13 },
  toggleHighlight: {
    color: "#4B5320",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
  },
  footerSection: { alignItems: "center", marginTop: 32 },
  footerDivider: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginTop: 16,
  },
  footerText: {
    color: "#444",
    fontSize: 9,
    letterSpacing: 3,
    marginHorizontal: 12,
  },
  versionText: {
    color: "#444",
    fontSize: 9,
    letterSpacing: 2,
    marginTop: 10,
  },


});
