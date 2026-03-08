import React from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  type TouchableOpacityProps,
  View,
  StyleSheet,
} from "react-native";

interface TacticalButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

const VARIANT_STYLES = {
  primary: {
    bg: "rgba(75,83,32,0.65)",
    border: "#5C6B2A",
    text: "#E0E0E0",
  },
  secondary: {
    bg: "rgba(42,42,42,0.6)",
    border: "#444444",
    text: "#A0A0A0",
  },
  danger: {
    bg: "rgba(139,0,0,0.65)",
    border: "#A52A2A",
    text: "#E0E0E0",
  },
  ghost: {
    bg: "transparent",
    border: "#444444",
    text: "#A0A0A0",
  },
};

export default function TacticalButton({
  title,
  variant = "primary",
  loading = false,
  icon,
  fullWidth = true,
  disabled,
  style,
  ...props
}: TacticalButtonProps) {
  const colors = VARIANT_STYLES[variant];

  return (
    <TouchableOpacity
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={[
        styles.button,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
          width: fullWidth ? "100%" : undefined,
          opacity: disabled || loading ? 0.5 : 1,
        },
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.text} />
      ) : (
        <>
          {icon && <View style={styles.iconWrap}>{icon}</View>}
          <Text style={[styles.text, { color: colors.text }]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 3,
    borderWidth: 1,
  },
  iconWrap: {
    marginRight: 12,
  },
  text: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 3,
    textTransform: "uppercase",
  },
});
