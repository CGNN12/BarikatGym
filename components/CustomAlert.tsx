import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, Modal, Pressable, TouchableOpacity,
  Animated, Easing, Dimensions,
} from "react-native";

// ═══════════ TYPES ═══════════
interface AlertButton {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
}

interface AlertConfig {
  title: string;
  message: string;
  buttons?: AlertButton[];
}

interface AlertContextType {
  showAlert: (title: string, message: string, buttons?: AlertButton[]) => void;
}

// ═══════════ CONTEXT ═══════════
const AlertContext = createContext<AlertContextType>({ showAlert: () => {} });

export const useAlert = () => useContext(AlertContext);

// ═══════════ PROVIDER ═══════════
export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<AlertConfig>({ title: "", message: "" });
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const showAlert = useCallback((title: string, message: string, buttons?: AlertButton[]) => {
    setConfig({ title, message, buttons });
    setVisible(true);
  }, []);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, damping: 18, stiffness: 200, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  const dismiss = useCallback(() => setVisible(false), []);

  const handleButton = useCallback((btn: AlertButton) => {
    setVisible(false);
    // Small delay so modal closes smoothly before callback runs
    setTimeout(() => { btn.onPress?.(); }, 150);
  }, []);

  const buttons = config.buttons && config.buttons.length > 0
    ? config.buttons
    : [{ text: "TAMAM", style: "default" as const }];

  // Strip emojis from displayed text for a clean, professional look
  const stripEmoji = (str: string) => str.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1FA00}-\u{1FAFF}\u{200D}\u{20E3}]/gu, "").replace(/\s{2,}/g, " ").trim();

  const cleanTitle = stripEmoji(config.title);
  const cleanMessage = stripEmoji(config.message);

  // Detect type from title keywords (no emoji dependency)
  const titleUpper = cleanTitle.toUpperCase();
  const hasDestructiveBtn = buttons.some(b => b.style === "destructive");
  const isError = /HATA|BAŞARISIZ/.test(titleUpper);
  const isSuccess = /BAŞARILI|YAPILDI|KAYDEDİLDİ|YENİLENDİ|AKTİF EDİLDİ|TAMAMLANDI/.test(titleUpper);
  const isWarning = /DONDURULDU|DONDURMA/.test(titleUpper);
  // If any button is destructive (e.g. "ÇIKIŞ YAP"), treat as red confirmation
  const effectiveType = isError || hasDestructiveBtn ? "error" : isSuccess ? "success" : isWarning ? "warning" : "default";
  const borderColor = effectiveType === "error" ? "rgba(192,57,43,0.6)" : effectiveType === "success" ? "rgba(75,83,32,0.8)" : effectiveType === "warning" ? "rgba(93,173,226,0.6)" : "rgba(75,83,32,0.5)";
  const glowColor = effectiveType === "error" ? "rgba(192,57,43,0.3)" : effectiveType === "success" ? "rgba(75,83,32,0.4)" : effectiveType === "warning" ? "rgba(93,173,226,0.3)" : "rgba(75,83,32,0.25)";

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss}>
        <Pressable style={st.overlay} onPress={dismiss}>
          <Animated.View style={[st.container, { transform: [{ scale: scaleAnim }], opacity: opacityAnim, borderColor, shadowColor: glowColor }]}>
            <Pressable onPress={() => {}}>
              {/* Top accent line */}
              <View style={[st.accentLine, { backgroundColor: borderColor }]} />

              {/* Title */}
              <Text style={[st.title, effectiveType === "error" && { color: "#E74C3C" }, effectiveType === "success" && { color: "#6B8E23" }, effectiveType === "warning" && { color: "#5DADE2" }]}>
                {cleanTitle}
              </Text>

              {/* Separator */}
              <View style={st.sep}><View style={st.sepLine} /><View style={st.sepDot} /><View style={st.sepLine} /></View>

              {/* Message */}
              <Text style={st.message}>{cleanMessage}</Text>

              {/* Buttons */}
              <View style={[st.buttonRow, buttons.length === 1 && { justifyContent: "center" }]}>
                {buttons.map((btn, i) => {
                  const isCancel = btn.style === "cancel";
                  const isDestructive = btn.style === "destructive";
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[
                        st.button,
                        buttons.length > 1 && { flex: 1 },
                        isCancel && st.buttonCancel,
                        isDestructive && st.buttonDestructive,
                        !isCancel && !isDestructive && st.buttonDefault,
                      ]}
                      activeOpacity={0.7}
                      onPress={() => handleButton(btn)}
                    >
                      <Text style={[
                        st.buttonText,
                        isCancel && st.buttonTextCancel,
                        isDestructive && st.buttonTextDestructive,
                      ]}>
                        {btn.text}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </AlertContext.Provider>
  );
}

// ═══════════ STYLES ═══════════
const { width: SW } = Dimensions.get("window");

const st = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.82)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  container: {
    width: SW - 48,
    maxWidth: 380,
    backgroundColor: "#1A1A1A",
    borderRadius: 8,
    borderWidth: 1.5,
    paddingBottom: 20,
    overflow: "hidden",
    // Glow
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 15,
  },
  accentLine: {
    height: 3,
    width: "100%",
    marginBottom: 18,
  },
  title: {
    color: "#E0E0E0",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 2,
    textAlign: "center",
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  sep: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    marginBottom: 14,
  },
  sepLine: { flex: 1, height: 1, backgroundColor: "#333" },
  sepDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#4B5320" },
  message: {
    color: "#B0B0B0",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    paddingHorizontal: 22,
    marginBottom: 22,
    letterSpacing: 0.3,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 18,
  },
  button: {
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDefault: {
    backgroundColor: "rgba(75,83,32,0.55)",
    borderColor: "#5C6B2A",
  },
  buttonCancel: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderColor: "#444",
  },
  buttonDestructive: {
    backgroundColor: "rgba(192,57,43,0.35)",
    borderColor: "rgba(192,57,43,0.6)",
  },
  buttonText: {
    color: "#E0E0E0",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 3,
  },
  buttonTextCancel: {
    color: "#888",
  },
  buttonTextDestructive: {
    color: "#E74C3C",
  },
});
