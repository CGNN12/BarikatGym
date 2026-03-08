import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
  Animated,
  Easing,
} from "react-native";
import {
  Bell,
  ShieldAlert,
  AlertTriangle,
  Trash2,
  X,
} from "lucide-react-native";

// ═══════════ MOCK VIOLATIONS ═══════════
interface Violation {
  id: string;
  memberName: string;
  description: string;
  time: string;
  severity: "high" | "medium";
}

const INITIAL_VIOLATIONS: Violation[] = [];

// ═══════════ PULSE ANIMATION FOR BADGE ═══════════
function PulseBadge({ count }: { count: number }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (count === 0) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [count, pulseAnim]);

  if (count === 0) return null;

  return (
    <Animated.View
      style={[styles.badge, { transform: [{ scale: pulseAnim }] }]}
    >
      <Text style={styles.badgeText}>{count}</Text>
    </Animated.View>
  );
}

// ═══════════ MAIN COMPONENT ═══════════
export default function SecurityBell() {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [violations, setViolations] = useState<Violation[]>(INITIAL_VIOLATIONS);

  const handleClearAll = () => {
    setViolations([]);
    setIsModalVisible(false);
  };

  return (
    <>
      {/* ═══ BELL TRIGGER ═══ */}
      <TouchableOpacity
        onPress={() => setIsModalVisible(true)}
        style={styles.bellBtn}
        activeOpacity={0.7}
      >
        <Bell size={20} color={violations.length > 0 ? "#999" : "#555"} />
        <PulseBadge count={violations.length} />
      </TouchableOpacity>

      {/* ═══ VIOLATION REPORT MODAL ═══ */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => setIsModalVisible(false)}
        >
          <Pressable style={styles.modalBox} onPress={() => {}}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <ShieldAlert size={18} color="#E74C3C" />
                <Text style={styles.modalTitle}>GÜVENLİK İHLALİ RAPORU</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsModalVisible(false)}
                style={styles.closeBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={16} color="#666" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>SECURITY BREACH LOG</Text>

            {/* Separator */}
            <View style={styles.separator}>
              <View style={styles.sepLine} />
              <AlertTriangle size={12} color="#E74C3C" />
              <View style={styles.sepLine} />
            </View>

            {/* Violation List */}
            <ScrollView
              style={styles.listScroll}
              showsVerticalScrollIndicator={false}
            >
              {violations.length === 0 ? (
                <View style={styles.emptyState}>
                  <ShieldAlert size={28} color="#2A2A2A" />
                  <Text style={styles.emptyTitle}>TEMİZ BÖLGE</Text>
                  <Text style={styles.emptySub}>
                    Kayıtlı güvenlik ihlali bulunmuyor.
                  </Text>
                </View>
              ) : (
                violations.map((v, index) => (
                  <View
                    key={v.id}
                    style={[
                      styles.violationCard,
                      index === violations.length - 1 && { marginBottom: 0 },
                    ]}
                  >
                    <View style={styles.violationLeft}>
                      <View style={styles.violationIcon}>
                        <AlertTriangle
                          size={14}
                          color={v.severity === "high" ? "#E74C3C" : "#D4A017"}
                        />
                      </View>
                      <View style={styles.violationInfo}>
                        <Text style={styles.violationName}>
                          {v.memberName}
                        </Text>
                        <Text style={styles.violationDesc}>
                          {v.description}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.violationTime}>
                      <Text style={styles.violationTimeText}>{v.time}</Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            {/* Actions */}
            <View style={styles.actions}>
              {violations.length > 0 && (
                <TouchableOpacity
                  onPress={handleClearAll}
                  style={styles.clearBtn}
                  activeOpacity={0.7}
                >
                  <Trash2 size={14} color="#E74C3C" />
                  <Text style={styles.clearText}>RAPORU TEMİZLE</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={() => setIsModalVisible(false)}
                style={styles.dismissBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.dismissText}>KAPAT</Text>
              </TouchableOpacity>
            </View>

            {/* Footer */}
            <View style={styles.modalFooter}>
              <View style={styles.sepLine} />
              <Text style={styles.footerText}>BARİKAT • GÜVENLİK MODÜLÜ</Text>
              <View style={styles.sepLine} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// ═══════════ STYLES ═══════════
const styles = StyleSheet.create({
  // ── BELL BUTTON ──
  bellBtn: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: "rgba(26,26,26,0.65)",
    borderWidth: 1,
    borderColor: "rgba(75,83,32,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#E74C3C",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#121212",
  },
  badgeText: {
    color: "#FFF",
    fontSize: 9,
    fontWeight: "900",
  },

  // ── MODAL ──
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.88)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalBox: {
    width: "100%",
    maxWidth: 400,
    maxHeight: "75%",
    backgroundColor: "#1A1A1A",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E74C3C",
    paddingVertical: 22,
    paddingHorizontal: 18,
    shadowColor: "#E74C3C",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 15,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  modalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalTitle: {
    color: "#E0E0E0",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
  },
  closeBtn: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  modalSubtitle: {
    color: "#E74C3C",
    fontSize: 8,
    letterSpacing: 4,
    fontWeight: "600",
    marginLeft: 26,
    marginBottom: 14,
  },
  separator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  sepLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#2A2A2A",
  },

  // ── VIOLATION CARDS ──
  listScroll: {
    maxHeight: 240,
    marginBottom: 16,
  },
  violationCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(231, 76, 60, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(231, 76, 60, 0.2)",
    borderRadius: 6,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  violationLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  violationIcon: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: "rgba(231, 76, 60, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  violationInfo: {
    flex: 1,
    gap: 2,
  },
  violationName: {
    color: "#E0E0E0",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  violationDesc: {
    color: "#888",
    fontSize: 10,
    letterSpacing: 0.3,
  },
  violationTime: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
    backgroundColor: "rgba(231, 76, 60, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(231, 76, 60, 0.25)",
    marginLeft: 8,
  },
  violationTimeText: {
    color: "#E74C3C",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    fontVariant: ["tabular-nums"],
  },

  // ── EMPTY STATE ──
  emptyState: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 8,
  },
  emptyTitle: {
    color: "#444",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 4,
  },
  emptySub: {
    color: "#333",
    fontSize: 11,
    letterSpacing: 1,
  },

  // ── ACTIONS ──
  actions: {
    gap: 8,
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 4,
    backgroundColor: "rgba(231, 76, 60, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(231, 76, 60, 0.35)",
  },
  clearText: {
    color: "#E74C3C",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
  },
  dismissBtn: {
    alignItems: "center",
    paddingVertical: 10,
  },
  dismissText: {
    color: "#666",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 3,
  },

  // ── FOOTER ──
  modalFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
  },
  footerText: {
    color: "#2A2A2A",
    fontSize: 8,
    fontWeight: "600",
    letterSpacing: 3,
  },
});
