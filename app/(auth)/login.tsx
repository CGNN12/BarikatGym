import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Mail, Lock, Shield, User } from "lucide-react-native";
import { APP_NAME, APP_SUBTITLE } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import TacticalInput from "@/components/TacticalInput";
import TacticalButton from "@/components/TacticalButton";
import DeerLogo from "@/components/DeerLogo";

export default function LoginScreen() {
  const { signIn, signUp, loading } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
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

    try {
      if (isSignUp) {
        await signUp(email.trim(), password, fullName.trim());
        Alert.alert(
          "KAYIT BAŞARILI",
          "Doğrulama bağlantısı e-posta adresinize gönderildi. Lütfen gelen kutunuzu (ve Spam/Gereksiz klasörünü) kontrol ediniz.",
          [{ text: "TAMAM", onPress: () => setIsSignUp(false) }]
        );
      } else {
        await signIn(email.trim(), password);
      }
    } catch (error: unknown) {
      let errorMessage = "Bir hata oluştu. Lütfen tekrar deneyin.";
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }

      Alert.alert(
        isSignUp ? "KAYIT BAŞARISIZ" : "GİRİŞ BAŞARISIZ",
        errorMessage,
        [{ text: "ANLAŞILDI", style: "cancel" }]
      );
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setErrors({});
    setConfirmPassword("");
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
              <DeerLogo width={180} height={200} opacity={0.3} />
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
                  <Shield size={12} color="#555" />
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

              <View style={styles.buttonWrap}>
                <TacticalButton
                  title={isSignUp ? "KAYIT OL" : "GİRİŞ YAP"}
                  onPress={handleSubmit}
                  loading={loading}
                  icon={<Shield size={18} color="#E0E0E0" />}
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
                <Text style={styles.footerText}>BARİKAT SPOR SİSTEMLERİ</Text>
                <View style={styles.secureLine} />
              </View>
              <Text style={styles.versionText}>
                v1.0.0 • GÜVENLİ ERİŞİM
              </Text>
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
