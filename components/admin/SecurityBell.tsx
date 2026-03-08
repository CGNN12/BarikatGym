import React, { useState, useRef, useEffect, useCallback } from "react";
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
  ActivityIndicator,
} from "react-native";
import {
  Bell,
  ShieldAlert,
  AlertTriangle,
  Eye,
  X,
  CheckCheck,
  Clock,
  UserX,
} from "lucide-react-native";
import { supabase } from "@/lib/supabase";

// ═══════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════

interface Notification {
  id: string;
  user_id: string;
  message: string;
  is_read: boolean;
  type: string;
  created_at: string;
  // joined from profiles
  profiles?: { full_name: string } | null;
}

// ═══════════════════════════════════════════════════════════
// PULSE ANIMATION FOR BADGE
// ═══════════════════════════════════════════════════════════

function PulseBadge({ count }: { count: number }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (count === 0) return;

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.35,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.5,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    pulseLoop.start();
    glowLoop.start();

    return () => {
      pulseLoop.stop();
      glowLoop.stop();
    };
  }, [count, pulseAnim, glowAnim]);

  if (count === 0) return null;

  return (
    <>
      {/* Glow ring behind badge */}
      <Animated.View
        style={[
          styles.badgeGlow,
          { opacity: glowAnim, transform: [{ scale: pulseAnim }] },
        ]}
      />
      {/* Main badge */}
      <Animated.View
        style={[styles.badge, { transform: [{ scale: pulseAnim }] }]}
      >
        <Text style={styles.badgeText}>
          {count > 9 ? "9+" : count}
        </Text>
      </Animated.View>
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// FORMAT HELPERS
// ═══════════════════════════════════════════════════════════

function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "Az önce";
  if (diffMin < 60) return `${diffMin} dk önce`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} saat önce`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} gün önce`;
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════

export default function SecurityBell() {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // ─── Fetch unread count (lightweight, runs on interval) ───
  const fetchUnreadCount = useCallback(async () => {
    try {
      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("is_read", false);

      if (!error && count !== null) {
        setUnreadCount(count);
      }
    } catch (e) {
      // Silent — don't crash the header
    }
  }, []);

  // ─── Fetch all notifications (when modal opens) ───
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*, profiles!notifications_user_id_fkey(full_name)")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("❌ [BELL] Bildirim sorgu hatası:", error.message);

        // Fallback: Try without join if FK doesn't exist yet
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("notifications")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50);

        if (!fallbackError && fallbackData) {
          setNotifications(fallbackData as Notification[]);
        }
        return;
      }

      setNotifications((data ?? []) as Notification[]);
    } catch (e) {
      console.error("❌ [BELL] Fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Poll unread count every 15 seconds ───
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 15000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // ─── Realtime subscription for notifications ───
  useEffect(() => {
    const channel = supabase
      .channel("admin_notifications")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => {
          fetchUnreadCount();
          if (isModalVisible) {
            fetchNotifications();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchUnreadCount, fetchNotifications, isModalVisible]);

  // ─── Open Modal Handler ───
  const handleOpenModal = useCallback(() => {
    setIsModalVisible(true);
    fetchNotifications();
  }, [fetchNotifications]);

  // ─── Mark single notification as read ───
  const markAsRead = useCallback(
    async (notifId: string) => {
      try {
        await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("id", notifId);

        setNotifications((prev) =>
          prev.map((n) => (n.id === notifId ? { ...n, is_read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (e) {
        console.error("❌ [BELL] Mark as read error:", e);
      }
    },
    []
  );

  // ─── Mark ALL as read ───
  const markAllAsRead = useCallback(async () => {
    try {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("is_read", false);

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error("❌ [BELL] Mark all read error:", e);
    }
  }, []);

  const unreadNotifications = notifications.filter((n) => !n.is_read);
  const readNotifications = notifications.filter((n) => n.is_read);

  return (
    <>
      {/* ═══ BELL TRIGGER ═══ */}
      <TouchableOpacity
        onPress={handleOpenModal}
        style={styles.bellBtn}
        activeOpacity={0.7}
      >
        <Bell
          size={20}
          color={unreadCount > 0 ? "#E74C3C" : "#555"}
        />
        <PulseBadge count={unreadCount} />
      </TouchableOpacity>

      {/* ═══ NOTIFICATION MODAL ═══ */}
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

            {/* Notification List */}
            <ScrollView
              style={styles.listScroll}
              showsVerticalScrollIndicator={false}
            >
              {loading ? (
                <View style={styles.emptyState}>
                  <ActivityIndicator size="small" color="#E74C3C" />
                  <Text style={styles.emptySub}>Bildirimler yükleniyor...</Text>
                </View>
              ) : notifications.length === 0 ? (
                <View style={styles.emptyState}>
                  <ShieldAlert size={28} color="#2A2A2A" />
                  <Text style={styles.emptyTitle}>TEMİZ BÖLGE</Text>
                  <Text style={styles.emptySub}>
                    Kayıtlı güvenlik ihlali bulunmuyor.
                  </Text>
                </View>
              ) : (
                <>
                  {/* Unread section */}
                  {unreadNotifications.length > 0 && (
                    <>
                      <View style={styles.sectionHeader}>
                        <View style={styles.sectionDot} />
                        <Text style={styles.sectionTitle}>
                          OKUNMAMIŞ ({unreadNotifications.length})
                        </Text>
                        <View style={styles.sectionLine} />
                      </View>
                      {unreadNotifications.map((notif) => (
                        <TouchableOpacity
                          key={notif.id}
                          style={styles.notifCardUnread}
                          activeOpacity={0.7}
                          onPress={() => markAsRead(notif.id)}
                        >
                          <View style={styles.notifLeft}>
                            <View style={styles.notifIconWrap}>
                              <UserX size={14} color="#E74C3C" />
                            </View>
                            <View style={styles.notifInfo}>
                              <Text
                                style={styles.notifMessage}
                                numberOfLines={3}
                              >
                                {notif.message}
                              </Text>
                              <View style={styles.notifTimeline}>
                                <Clock size={10} color="#666" />
                                <Text style={styles.notifTime}>
                                  {formatTimeAgo(notif.created_at)} •{" "}
                                  {formatTime(notif.created_at)}
                                </Text>
                              </View>
                            </View>
                          </View>
                          <View style={styles.notifAction}>
                            <Eye size={14} color="#555" />
                          </View>
                        </TouchableOpacity>
                      ))}
                    </>
                  )}

                  {/* Read section */}
                  {readNotifications.length > 0 && (
                    <>
                      <View style={[styles.sectionHeader, { marginTop: unreadNotifications.length > 0 ? 16 : 0 }]}>
                        <View
                          style={[styles.sectionDot, { backgroundColor: "#333" }]}
                        />
                        <Text
                          style={[styles.sectionTitle, { color: "#444" }]}
                        >
                          GEÇMİŞ ({readNotifications.length})
                        </Text>
                        <View style={styles.sectionLine} />
                      </View>
                      {readNotifications.map((notif) => (
                        <View key={notif.id} style={styles.notifCardRead}>
                          <View style={styles.notifLeft}>
                            <View style={styles.notifIconWrapRead}>
                              <UserX size={14} color="#444" />
                            </View>
                            <View style={styles.notifInfo}>
                              <Text
                                style={styles.notifMessageRead}
                                numberOfLines={2}
                              >
                                {notif.message}
                              </Text>
                              <View style={styles.notifTimeline}>
                                <Clock size={10} color="#444" />
                                <Text style={styles.notifTimeRead}>
                                  {formatTimeAgo(notif.created_at)}
                                </Text>
                              </View>
                            </View>
                          </View>
                          <CheckCheck size={14} color="#4B5320" />
                        </View>
                      ))}
                    </>
                  )}
                </>
              )}
            </ScrollView>

            {/* Actions */}
            <View style={styles.actions}>
              {unreadCount > 0 && (
                <TouchableOpacity
                  onPress={markAllAsRead}
                  style={styles.markAllBtn}
                  activeOpacity={0.7}
                >
                  <CheckCheck size={14} color="#4B5320" />
                  <Text style={styles.markAllText}>TÜMÜNÜ OKUNDU İŞARETLE</Text>
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

// ═══════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════

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
    top: -5,
    right: -5,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#E74C3C",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#121212",
    paddingHorizontal: 4,
  },
  badgeGlow: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(231, 76, 60, 0.3)",
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
    maxHeight: "80%",
    backgroundColor: "#1A1A1A",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E74C3C",
    paddingVertical: 22,
    paddingHorizontal: 18,
    shadowColor: "#E74C3C",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 25,
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

  // ── SECTION HEADERS ──
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  sectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#E74C3C",
  },
  sectionTitle: {
    color: "#E74C3C",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 2,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#2A2A2A",
  },

  // ── NOTIFICATION CARDS ──
  listScroll: {
    maxHeight: 360,
    marginBottom: 16,
  },
  notifCardUnread: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(231, 76, 60, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(231, 76, 60, 0.25)",
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  notifCardRead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(26,26,26,0.4)",
    borderWidth: 1,
    borderColor: "#2A2A2A",
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  notifLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    flex: 1,
  },
  notifIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: "rgba(231, 76, 60, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  notifIconWrapRead: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: "rgba(51, 51, 51, 0.4)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  notifInfo: {
    flex: 1,
    gap: 4,
  },
  notifMessage: {
    color: "#E0E0E0",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.3,
    lineHeight: 17,
  },
  notifMessageRead: {
    color: "#666",
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 0.3,
    lineHeight: 16,
  },
  notifTimeline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  notifTime: {
    color: "#666",
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 1,
  },
  notifTimeRead: {
    color: "#444",
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 1,
  },
  notifAction: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.03)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
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
  markAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 4,
    backgroundColor: "rgba(75, 83, 32, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(75, 83, 32, 0.4)",
  },
  markAllText: {
    color: "#4B5320",
    fontSize: 10,
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
