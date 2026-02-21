import React, { useEffect, useRef } from "react";
import { View, Text, Animated, StyleSheet } from "react-native";
import { Users } from "lucide-react-native";

interface OccupancyDisplayProps {
  count: number;
}

export default function OccupancyDisplay({ count }: OccupancyDisplayProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );

    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.8,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.3,
          duration: 2000,
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

  const isEmpty = count === 0;
  const statusColor = isEmpty ? "#555" : "#4B5320";

  return (
    <View style={styles.wrapper}>
      <Animated.View
        style={[
          styles.card,
          {
            borderColor: statusColor,
            shadowColor: statusColor,
            opacity: glowAnim.interpolate({
              inputRange: [0.3, 0.8],
              outputRange: [0.9, 1],
            }),
          },
        ]}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <Users size={16} color="#A0A0A0" />
          <Text style={styles.headerText}>CANLI TAKİP</Text>
          {!isEmpty && <View style={[styles.liveDot, { backgroundColor: statusColor }]} />}
        </View>

        {/* Big Number */}
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <Text style={[styles.bigNumber, { color: isEmpty ? "#555" : "#E0E0E0" }]}>
            {count}
          </Text>
        </Animated.View>

        {/* Label below number */}
        <Text style={[styles.label, { color: isEmpty ? "#555" : "#A0A0A0" }]}>
          {isEmpty ? "SALON BOŞ" : "AKTİF SPORCU"}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    alignItems: "center",
  },
  card: {
    width: "100%",
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderRadius: 3,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: "center",
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 12,
    elevation: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  headerText: {
    color: "#A0A0A0",
    fontSize: 10,
    letterSpacing: 4,
    textTransform: "uppercase",
    marginLeft: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 10,
  },
  bigNumber: {
    fontSize: 96,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
    lineHeight: 110,
  },
  label: {
    fontSize: 12,
    letterSpacing: 5,
    fontWeight: "700",
    textTransform: "uppercase",
    marginTop: 4,
  },
});
