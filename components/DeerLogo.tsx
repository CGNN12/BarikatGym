import React from "react";
import { View, Image, StyleSheet } from "react-native";

interface DeerLogoProps {
  width?: number;
  height?: number;
  opacity?: number;
  color?: string; // Renk prop'u resim modunda etkisiz kalabilir ama uyumluluk için tutuyoruz
}

export default function DeerLogo({
  width = 200,
  height = 220,
  opacity = 1,
}: DeerLogoProps) {
  return (
    <View style={{ width, height, opacity, alignItems: "center", justifyContent: "center" }}>
      <Image
        // ⚠️ Lütfen 'assets' klasörüne 'logo.png' adında görselinizi ekleyin
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
