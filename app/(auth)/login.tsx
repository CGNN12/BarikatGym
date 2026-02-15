import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Mail, Lock, Shield } from "lucide-react-native";
import { COLORS, APP_NAME, APP_SUBTITLE } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import TacticalInput from "@/components/TacticalInput";
import TacticalButton from "@/components/TacticalButton";
import DeerLogo from "@/components/DeerLogo";

export default function LoginScreen() {
  const { signIn, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {}
  );

  const validate = (): boolean => {
    const newErrors: { email?: string; password?: string } = {};

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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;

    try {
      await signIn(email.trim(), password);
    } catch (error: any) {
      Alert.alert(
        "GİRİŞ BAŞARISIZ",
        error.message || "Kimlik doğrulama hatası. Tekrar deneyin.",
        [{ text: "ANLAŞILDI", style: "cancel" }]
      );
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-tactical-black">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-1 px-6 pt-8 pb-6 justify-between">
            {/* ═══════════ HEADER SECTION ═══════════ */}
            <View className="items-center">
              {/* Deer Logo */}
              <DeerLogo width={180} height={200} opacity={0.2} />

              {/* App Name */}
              <View className="items-center mt-2">
                <Text
                  className="text-4xl tracking-[0.35em] text-tactical-text"
                  style={{ fontFamily: "Inter_900Black" }}
                >
                  {APP_NAME}
                </Text>
                <View className="flex-row items-center mt-1">
                  <View className="h-[1px] w-8 bg-tactical-green mr-3" />
                  <Text
                    className="text-xs tracking-[0.3em] text-tactical-green"
                    style={{ fontFamily: "Inter_500Medium" }}
                  >
                    {APP_SUBTITLE}
                  </Text>
                  <View className="h-[1px] w-8 bg-tactical-green ml-3" />
                </View>
              </View>

              {/* Tactical divider */}
              <View className="w-full mt-8 mb-2">
                <View className="flex-row items-center">
                  <View className="flex-1 h-[1px] bg-tactical-border" />
                  <View className="mx-3 flex-row items-center">
                    <Shield size={12} color={COLORS.textDark} />
                    <Text className="text-tactical-textDark text-[10px] tracking-widest ml-1.5 uppercase">
                      Güvenli Giriş
                    </Text>
                  </View>
                  <View className="flex-1 h-[1px] bg-tactical-border" />
                </View>
              </View>
            </View>

            {/* ═══════════ FORM SECTION ═══════════ */}
            <View className="mt-6">
              <TacticalInput
                label="E-Posta"
                placeholder="operatör@barikat.com"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (errors.email) setErrors((e) => ({ ...e, email: undefined }));
                }}
                keyboardType="email-address"
                autoComplete="email"
                error={errors.email}
                icon={<Mail size={18} color={COLORS.textDark} />}
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
                icon={<Lock size={18} color={COLORS.textDark} />}
              />

              {/* Login Button */}
              <View className="mt-6">
                <TacticalButton
                  title="SİSTEME GİRİŞ"
                  onPress={handleLogin}
                  loading={loading}
                  icon={<Shield size={18} color={COLORS.text} />}
                />
              </View>
            </View>

            {/* ═══════════ FOOTER SECTION ═══════════ */}
            <View className="items-center mt-8">
              {/* Bottom decorative line */}
              <View className="flex-row items-center mt-4 w-full">
                <View className="flex-1 h-[1px] bg-tactical-border" />
                <Text className="text-tactical-textDark text-[9px] tracking-widest mx-3">
                  BARIKAT DEFENCE SYSTEMS
                </Text>
                <View className="flex-1 h-[1px] bg-tactical-border" />
              </View>

              {/* Version */}
              <Text className="text-tactical-textDark text-[9px] tracking-wider mt-3">
                v1.0.0 • SECURED CONNECTION
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
