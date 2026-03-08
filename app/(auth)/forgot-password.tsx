import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, ScrollView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Mail, ArrowLeft, Send } from "lucide-react-native";
import { useAlert } from "@/components/CustomAlert";
import { supabase } from "@/lib/supabase";
import TacticalInput from "@/components/TacticalInput";
import TacticalButton from "@/components/TacticalButton";
import DeerLogo from "@/components/DeerLogo";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { showAlert } = useAlert();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async () => {
    if (!email.trim() || !email.includes("@")) {
      showAlert("HATA", "Lütfen geçerli bir e-posta adresi girin.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) throw error;
      
      showAlert("BAŞARILI", "Şifre sıfırlama bağlantısı e-posta adresinize gönderildi. Lütfen gelen kutunuzu (ve gerekiyorsa spam klasörünü) kontrol edin.", [
        { text: "TAMAM", onPress: () => router.push("/(auth)/login") }
      ]);
    } catch (error: any) {
      showAlert("HATA", error.message || "Şifre sıfırlama işlemi başarısız oldu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.container}>
            {/* Header / Back Button */}
            <View style={styles.header}>
              <TouchableOpacity style={styles.backButton} onPress={() => router.replace("/(auth)/login")} activeOpacity={0.7}>
                <ArrowLeft size={20} color="#E0E0E0" />
                <Text style={styles.backButtonText}>GİRİŞE DÖN</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.content}>
              <View style={styles.logoWrap}>
                <DeerLogo width={180} height={200} opacity={0.3} />
              </View>

              <Text style={styles.title}>ŞİFRE SIFIRLAMA</Text>
              <Text style={styles.description}>
                Barikat Sistemleri'ne kayıtlı e-posta adresinizi girin. Size şifrenizi sıfırlamanız için güvenli bir bağlantı göndereceğiz.
              </Text>

              <View style={styles.form}>
                <TacticalInput
                  label="E-Posta"
                  placeholder="sporcu@barikat.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  icon={<Mail size={18} color="#555" />}
                />

                <View style={styles.buttonWrap}>
                  <TacticalButton
                    title="BAĞLANTIYI GÖNDER"
                    onPress={handleResetPassword}
                    loading={loading}
                    icon={<Send size={18} color="#E0E0E0" />}
                  />
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "transparent" }, // Using transparent ensures parent wrapper bg is visible
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 },
  header: { marginBottom: 12 },
  backButton: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, width: 140 },
  backButtonText: { color: "#E0E0E0", fontSize: 12, fontWeight: "700", letterSpacing: 2 },
  content: { flex: 1, justifyContent: "center" },
  logoWrap: { alignItems: "center", marginBottom: 24 },
  title: { color: "#E0E0E0", fontSize: 24, fontWeight: "900", letterSpacing: 4, textAlign: "center", marginBottom: 16 },
  description: { color: "#888", fontSize: 13, lineHeight: 20, textAlign: "center", marginBottom: 32, paddingHorizontal: 16 },
  form: { marginTop: 10 },
  buttonWrap: { marginTop: 16 }
});
