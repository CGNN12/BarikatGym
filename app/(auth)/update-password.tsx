import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Animated,
  Easing,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { KeyRound, Eye, EyeOff, ShieldCheck, Lock, Check } from "lucide-react-native";
import { useAlert } from "@/components/CustomAlert";
import { supabase } from "@/lib/supabase";
import { PasswordRecoveryStore } from "@/lib/passwordRecoveryStore";

// ═══════════ RENK PALETİ (Army Green — Uygulama Temasıyla Uyumlu) ═══════════
const COLORS = {
  bg: "transparent",
  inputBg: "rgba(30,30,30,0.6)",
  inputBorder: "#444444",
  inputBorderFocused: "#5C6B2A",
  accent: "#4B5320",
  accentLight: "#5C6B2A",
  accentGlow: "rgba(75,83,32,0.4)",
  textPrimary: "#E0E0E0",
  textSecondary: "#888888",
  textMuted: "#555555",
  separator: "#333333",
  error: "#8B0000",
};

export default function UpdatePasswordScreen() {
  const router = useRouter();
  const { showAlert } = useAlert();

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [isFocused1, setIsFocused1] = useState(false);
  const [isFocused2, setIsFocused2] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const lockPulse = useRef(new Animated.Value(1)).current;
  const lockGlow = useRef(new Animated.Value(0.2)).current;

  // Entrance animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        easing: Easing.out(Easing.bezier(0.25, 0.1, 0.25, 1)),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Lock pulse animation
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(lockPulse, {
          toValue: 1.05,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(lockPulse, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(lockGlow, {
          toValue: 0.6,
          duration: 2500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(lockGlow, {
          toValue: 0.2,
          duration: 2500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    glow.start();
    return () => {
      pulse.stop();
      glow.stop();
    };
  }, []);

  // Safety: redirect to login if recovery mode not active
  useEffect(() => {
    if (!PasswordRecoveryStore.isActive()) {
      router.replace("/(auth)/login");
    }
  }, []);

  // Validation checks
  const hasMinLength = password.length >= 6;
  const passwordsMatch = password.length > 0 && password === passwordConfirm;
  const isFormValid = hasMinLength && passwordsMatch;

  const handleUpdatePassword = async () => {
    if (!password.trim() || password.length < 6) {
      showAlert("HATA", "Şifre en az 6 karakter olmalıdır.");
      return;
    }
    if (password !== passwordConfirm) {
      showAlert("HATA", "Şifreler eşleşmiyor.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setSuccess(true);
      await supabase.auth.signOut();
      PasswordRecoveryStore.deactivate();

      showAlert("BAŞARILI", "Şifreniz başarıyla güncellendi.\nYeni şifrenizle giriş yapabilirsiniz.", [
        {
          text: "GİRİŞ YAP",
          onPress: () => router.replace("/(auth)/login"),
        },
      ]);
    } catch (error: any) {
      showAlert("HATA", error.message || "Şifre güncelleme başarısız oldu.");
    } finally {
      setLoading(false);
    }
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
          <Animated.View
            style={[
              styles.container,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {/* ═══ ANIMATED LOCK ICON ═══ */}
            <View style={styles.iconSection}>
              <Animated.View
                style={[
                  styles.iconGlowOuter,
                  { opacity: lockGlow, transform: [{ scale: lockPulse }] },
                ]}
              />
              <Animated.View
                style={[
                  styles.iconGlowInner,
                  { opacity: lockGlow, transform: [{ scale: lockPulse }] },
                ]}
              />
              <Animated.View
                style={[
                  styles.iconCircle,
                  { transform: [{ scale: lockPulse }] },
                ]}
              >
                <Lock size={28} color={COLORS.accentLight} />
              </Animated.View>
            </View>

            {/* ═══ TITLE ═══ */}
            <Text style={styles.title}>YENİ ŞİFRE BELİRLE</Text>

            {/* ═══ SEPARATOR ═══ */}
            <View style={styles.separator}>
              <View style={styles.sepLine} />
              <View style={styles.sepDiamond} />
              <View style={styles.sepLine} />
            </View>

            {/* ═══ SUBTITLE ═══ */}
            <Text style={styles.subtitle}>
              Lütfen yeni ve güvenli şifrenizi oluşturun
            </Text>

            {/* ═══ FORM AREA ═══ */}
            <View style={styles.formSection}>
              {/* Password Field 1 */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>YENİ ŞİFRE</Text>
                <View
                  style={[
                    styles.inputContainer,
                    {
                      borderColor: isFocused1
                        ? COLORS.inputBorderFocused
                        : COLORS.inputBorder,
                      shadowColor: isFocused1 ? COLORS.accent : "#000",
                      shadowOpacity: isFocused1 ? 0.4 : 0.15,
                    },
                  ]}
                >
                  <View style={styles.inputIcon}>
                    <KeyRound size={18} color={COLORS.accentLight} />
                  </View>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Yeni Şifreniz"
                    placeholderTextColor={COLORS.textMuted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    selectionColor={COLORS.accentLight}
                    autoCapitalize="none"
                    onFocus={() => setIsFocused1(true)}
                    onBlur={() => setIsFocused1(false)}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={styles.eyeIcon}
                  >
                    {showPassword ? (
                      <Eye size={20} color={COLORS.textSecondary} />
                    ) : (
                      <EyeOff size={20} color={COLORS.textMuted} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Password Field 2 */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>YENİ ŞİFRE (TEKRAR)</Text>
                <View
                  style={[
                    styles.inputContainer,
                    {
                      borderColor: isFocused2
                        ? COLORS.inputBorderFocused
                        : COLORS.inputBorder,
                      shadowColor: isFocused2 ? COLORS.accent : "#000",
                      shadowOpacity: isFocused2 ? 0.4 : 0.15,
                    },
                  ]}
                >
                  <View style={styles.inputIcon}>
                    <KeyRound size={18} color={COLORS.accentLight} />
                  </View>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Yeni Şifrenizi Tekrar Girin"
                    placeholderTextColor={COLORS.textMuted}
                    value={passwordConfirm}
                    onChangeText={setPasswordConfirm}
                    secureTextEntry={!showPasswordConfirm}
                    selectionColor={COLORS.accentLight}
                    autoCapitalize="none"
                    onFocus={() => setIsFocused2(true)}
                    onBlur={() => setIsFocused2(false)}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPasswordConfirm(!showPasswordConfirm)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={styles.eyeIcon}
                  >
                    {showPasswordConfirm ? (
                      <Eye size={20} color={COLORS.textSecondary} />
                    ) : (
                      <EyeOff size={20} color={COLORS.textMuted} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* ═══ LIVE VALIDATION INDICATORS ═══ */}
              <View style={styles.validationCard}>
                <View style={styles.validationItem}>
                  <View
                    style={[
                      styles.validationDot,
                      hasMinLength && styles.validationDotActive,
                    ]}
                  >
                    {hasMinLength && <Check size={8} color="#FFF" />}
                  </View>
                  <Text
                    style={[
                      styles.validationText,
                      hasMinLength && styles.validationTextActive,
                    ]}
                  >
                    En az 6 karakter
                  </Text>
                </View>
                <View style={styles.validationItem}>
                  <View
                    style={[
                      styles.validationDot,
                      passwordsMatch && styles.validationDotActive,
                    ]}
                  >
                    {passwordsMatch && <Check size={8} color="#FFF" />}
                  </View>
                  <Text
                    style={[
                      styles.validationText,
                      passwordsMatch && styles.validationTextActive,
                    ]}
                  >
                    Şifreler eşleşiyor
                  </Text>
                </View>
              </View>

              {/* ═══ SUBMIT BUTTON ═══ */}
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (!isFormValid || loading || success) && styles.submitButtonDisabled,
                ]}
                activeOpacity={0.75}
                onPress={handleUpdatePassword}
                disabled={!isFormValid || loading || success}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={COLORS.textPrimary} />
                ) : (
                  <>
                    <ShieldCheck size={18} color={COLORS.textPrimary} style={{ marginRight: 10 }} />
                    <Text style={styles.submitButtonText}>ŞİFREYİ KAYDET</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* ═══ FOOTER ═══ */}
            <View style={styles.footer}>
              <View style={styles.footerLine} />
              <Text style={styles.footerText}>BARİKAT • ŞİFRE GÜVENLİĞİ</Text>
              <View style={styles.footerLine} />
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "transparent",
  },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  container: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: "center",
    paddingVertical: 40,
  },

  // ── Lock Icon ──
  iconSection: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
    position: "relative",
  },
  iconGlowOuter: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(75,83,32,0.08)",
  },
  iconGlowInner: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(75,83,32,0.12)",
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "rgba(75,83,32,0.15)",
    borderWidth: 1.5,
    borderColor: "rgba(75,83,32,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Typography ──
  title: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 5,
    textAlign: "center",
    marginBottom: 14,
  },
  separator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    alignSelf: "center",
    width: "70%",
    marginBottom: 14,
  },
  sepLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.separator,
  },
  sepDiamond: {
    width: 7,
    height: 7,
    borderRadius: 1,
    backgroundColor: COLORS.accent,
    transform: [{ rotate: "45deg" }],
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 36,
    letterSpacing: 0.3,
  },

  // ── Form ──
  formSection: {
    width: "100%",
  },
  inputGroup: {
    marginBottom: 18,
  },
  inputLabel: {
    color: "#A0A0A0",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 3,
    marginBottom: 8,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.inputBg,
    borderWidth: 1.5,
    borderRadius: 3,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  inputIcon: {
    marginRight: 12,
    width: 24,
    alignItems: "center",
  },
  textInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 16,
    padding: 0,
  },
  eyeIcon: {
    marginLeft: 8,
    padding: 4,
  },

  // ── Validation ──
  validationCard: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
    marginBottom: 28,
    marginTop: 4,
  },
  validationItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  validationDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: COLORS.textMuted,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  validationDotActive: {
    borderColor: COLORS.accentLight,
    backgroundColor: COLORS.accentLight,
  },
  validationText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  validationTextActive: {
    color: COLORS.accentLight,
  },

  // ── Button ──
  submitButton: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(75,83,32,0.65)",
    borderWidth: 1,
    borderColor: COLORS.accentLight,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 3,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  submitButtonDisabled: {
    opacity: 0.45,
  },
  submitButtonText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 3,
  },

  // ── Footer ──
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 48,
    alignSelf: "center",
    width: "100%",
  },
  footerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#1E1E1E",
  },
  footerText: {
    color: "#2A2A2A",
    fontSize: 8,
    fontWeight: "600",
    letterSpacing: 3,
  },
});
