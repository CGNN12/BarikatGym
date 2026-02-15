import React, { useEffect, useRef } from "react";
import { View, Text, Animated } from "react-native";
import { Users } from "lucide-react-native";
import { COLORS } from "@/constants/theme";

interface OccupancyDisplayProps {
  count: number;
  maxCapacity?: number;
}

export default function OccupancyDisplay({
  count,
  maxCapacity = 50,
}: OccupancyDisplayProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // Pulse animation for the count number
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

    // Glow animation for the border
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

  const occupancyPercent = Math.round((count / maxCapacity) * 100);
  const isHigh = occupancyPercent > 80;
  const isMedium = occupancyPercent > 50;

  const statusColor = isHigh
    ? COLORS.red
    : isMedium
    ? COLORS.amber
    : COLORS.green;

  const statusText = isHigh
    ? "YOĞUN"
    : isMedium
    ? "ORTA SEVİYE"
    : "UYGUN";

  return (
    <View className="w-full items-center">
      {/* Main Occupancy Card */}
      <Animated.View
        className="w-full bg-tactical-darkGray border border-tactical-border rounded-sm p-6 items-center"
        style={{
          borderColor: statusColor,
          shadowColor: statusColor,
          shadowOffset: { width: 0, height: 0 },
          shadowRadius: 12,
          elevation: 10,
          opacity: glowAnim.interpolate({
            inputRange: [0.3, 0.8],
            outputRange: [0.9, 1],
          }),
        }}
      >
        {/* Header */}
        <View className="flex-row items-center mb-2">
          <Users size={16} color={COLORS.textMuted} />
          <Text className="text-tactical-textMuted text-xs tracking-widest uppercase ml-2">
            CANLI DOLULUK
          </Text>
        </View>

        {/* Big Number */}
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <Text
            className="text-7xl font-black text-tactical-text"
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {count}
          </Text>
        </Animated.View>

        {/* Capacity Bar */}
        <View className="w-full h-1.5 bg-tactical-mediumGray rounded-sm mt-4 overflow-hidden">
          <View
            className="h-full rounded-sm"
            style={{
              width: `${Math.min(occupancyPercent, 100)}%`,
              backgroundColor: statusColor,
            }}
          />
        </View>

        {/* Stats row */}
        <View className="flex-row justify-between w-full mt-3">
          <Text className="text-tactical-textDark text-xs tracking-wider">
            {occupancyPercent}% KAPASİTE
          </Text>
          <View className="flex-row items-center">
            <View
              className="w-2 h-2 rounded-full mr-1.5"
              style={{ backgroundColor: statusColor }}
            />
            <Text
              className="text-xs tracking-wider font-semibold"
              style={{ color: statusColor }}
            >
              {statusText}
            </Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}
