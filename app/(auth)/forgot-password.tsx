import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, ScrollView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Mail, ArrowLeft, Send, ShieldCheck } from "lucide-react-native";
import { useAlert } from "@/components/CustomAlert";
import { supabase } from "@/lib/supabase";
import { PasswordRecoveryStore } from "@/lib/passwordRecoveryStore";
import TacticalInput from "@/components/TacticalInput";
import TacticalButton from "@/components/TacticalButton";
import DeerLogo from "@/components/DeerLogo";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { showAlert } = useAlert();
  
  // States
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendCode = async () => {
    if (!email.trim() || !email.includes("@")) {
      showAlert("HATA", "Lütfen geçerli bir e-posta adresi girin.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) throw error;
      
      showAlert("BAŞARILI", "E-postanıza 8 haneli doğrulama kodu gönderildi.");
      setStep(2);
    } catch (error: any) {
      showAlert("HATA", error.message || "Kod gönderme işlemi başarısız oldu.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim() || otp.trim().length !== 8) {
      showAlert("HATA", "Lütfen 8 haneli doğrulama kodunu girin.");
      return;
    }

    setLoading(true);
    try {
      // ÖNEMLİ: verifyOtp çağrılmadan ÖNCE recovery modunu aktif et!
      // Bu sayede Supabase otomatik session oluşturduğunda
      // AuthGuard kullanıcıyı Dashboard'a yönlendirmeyecek.
      PasswordRecoveryStore.activate();

      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otp.trim(),
        type: 'recovery'
      });
      if (error) {
        // OTP hatası — recovery modu iptal
        PasswordRecoveryStore.deactivate();
        throw error;
      }
      
      // OTP başarılı — AuthGuard'ın recovery mode ile yeniden render olmasını
      // beklemek için kısa bir gecikme ekle, ardından yeni ekrana yönlendir
      setTimeout(() => {
        setLoading(false);
        router.replace("/(auth)/update-password");
      }, 200);
      return; // finally'deki setLoading(false)'u atla — setTimeout halledecek
    } catch (error: any) {
      showAlert("HATA", error.message || "Doğrulama başarısız. Girdiğiniz kodu kontrol edin.");
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <>
            <Text style={styles.description}>
              Barikat Sistemleri'ne kayıtlı e-posta adresinizi girin. Size 8 haneli bir doğrulama kodu göndereceğiz.
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
                  title="KODU GÖNDER"
                  onPress={handleSendCode}
                  loading={loading}
                  icon={<Send size={18} color="#E0E0E0" />}
                />
              </View>
            </View>
          </>
        );
      case 2:
        return (
          <>
            <Text style={styles.description}>
              E-posta adresinize gönderdiğimiz 8 haneli doğrulama kodunu giriniz.
            </Text>
            <View style={styles.form}>
              <TacticalInput
                label="Doğrulama Kodu"
                placeholder="00000000"
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={8}
                icon={<ShieldCheck size={18} color="#555" />}
              />
              <View style={styles.buttonWrap}>
                <TacticalButton
                  title="DOĞRULA"
                  onPress={handleVerifyOtp}
                  loading={loading}
                  icon={<ShieldCheck size={18} color="#E0E0E0" />}
                />
              </View>
            </View>
          </>
        );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.container}>
            {/* Header / Back Button */}
            <View style={styles.header}>
              <TouchableOpacity
                style={styles.backButton}
                activeOpacity={0.7}
                onPress={() => {
                  PasswordRecoveryStore.deactivate();
                  router.replace("/(auth)/login");
                }}
              >
                <ArrowLeft size={20} color="#E0E0E0" />
                <Text style={styles.backButtonText}>GİRİŞ EKRANINA DÖN</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.content}>
              <View style={styles.logoWrap}>
                <DeerLogo width={180} height={200} opacity={0.3} />
              </View>

              <Text style={styles.title}>ŞİFRE SIFIRLAMA</Text>
              
              {renderStep()}

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
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 },
  header: { marginBottom: 12 },
  backButton: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  backButtonText: { color: "#E0E0E0", fontSize: 12, fontWeight: "700", letterSpacing: 2 },
  content: { flex: 1, justifyContent: "center" },
  logoWrap: { alignItems: "center", marginBottom: 24 },
  title: { color: "#E0E0E0", fontSize: 24, fontWeight: "900", letterSpacing: 4, textAlign: "center", marginBottom: 16 },
  description: { color: "#888", fontSize: 13, lineHeight: 20, textAlign: "center", marginBottom: 32, paddingHorizontal: 16 },
  form: { marginTop: 10 },
  buttonWrap: { marginTop: 16 }
});
