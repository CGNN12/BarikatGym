import React from "react";
import { View, Image } from "react-native";

interface DeerLogoProps {
  width?: number;
  height?: number;
  opacity?: number;
  color?: string;
}

export default function DeerLogo({
  width = 200,
  height = 220,
  opacity = 0.25,
}: DeerLogoProps) {
  return (
    <View
      style={{
        width,
        height,
        opacity,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Image
        source={require("@/assets/logo.png")}
        style={{
          width: "100%",
          height: "100%",
          resizeMode: "contain",
        }}
      />
    </View>
  );
}
