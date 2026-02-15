import React from "react";
import Svg, { Path, G, Defs, RadialGradient, Stop, Rect } from "react-native-svg";
import { View } from "react-native";

interface DeerLogoProps {
  width?: number;
  height?: number;
  opacity?: number;
  color?: string;
  glowColor?: string;
}

export default function DeerLogo({
  width = 200,
  height = 220,
  opacity = 0.15,
  color = "#4B5320",
  glowColor = "#4B5320",
}: DeerLogoProps) {
  return (
    <View style={{ width, height, alignItems: "center", justifyContent: "center" }}>
      <Svg
        width={width}
        height={height}
        viewBox="0 0 200 220"
        fill="none"
      >
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="40%" r="60%">
            <Stop offset="0%" stopColor={glowColor} stopOpacity={0.3} />
            <Stop offset="100%" stopColor={glowColor} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        {/* Background glow */}
        <Rect x="0" y="0" width="200" height="220" fill="url(#glow)" />

        <G opacity={opacity}>
          {/* Left Antler */}
          <Path
            d="M85 75 L70 30 L60 15 M70 30 L55 25 M70 30 L80 20 L75 5 M80 20 L90 10"
            stroke={color}
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />

          {/* Right Antler */}
          <Path
            d="M115 75 L130 30 L140 15 M130 30 L145 25 M130 30 L120 20 L125 5 M120 20 L110 10"
            stroke={color}
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />

          {/* Head */}
          <Path
            d="M85 75 Q82 85 80 95 Q78 105 82 110 Q85 115 90 118 L95 125 Q98 130 100 132 Q102 130 105 125 L110 118 Q115 115 118 110 Q122 105 120 95 Q118 85 115 75"
            fill={color}
          />

          {/* Ears */}
          <Path
            d="M80 78 Q72 72 70 80 Q72 88 80 85"
            fill={color}
          />
          <Path
            d="M120 78 Q128 72 130 80 Q128 88 120 85"
            fill={color}
          />

          {/* Eyes */}
          <Path
            d="M90 92 Q92 88 95 92 Q92 94 90 92"
            fill="#121212"
          />
          <Path
            d="M105 92 Q108 88 110 92 Q108 94 105 92"
            fill="#121212"
          />

          {/* Nose */}
          <Path
            d="M96 112 Q100 108 104 112 Q100 116 96 112"
            fill="#121212"
          />

          {/* Neck */}
          <Path
            d="M90 130 Q85 145 82 160 Q80 170 82 180 L85 195 Q90 205 100 210 Q110 205 115 195 L118 180 Q120 170 118 160 Q115 145 110 130"
            fill={color}
          />

          {/* Chest detail lines */}
          <Path
            d="M92 150 L100 165 L108 150"
            stroke="#121212"
            strokeWidth={1}
            strokeLinecap="round"
            fill="none"
            opacity={0.3}
          />
        </G>
      </Svg>
    </View>
  );
}
