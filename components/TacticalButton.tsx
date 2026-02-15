import React from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  type TouchableOpacityProps,
  View,
} from "react-native";

interface TacticalButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

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
  const baseClasses = "flex-row items-center justify-center py-4 px-6 rounded-sm";
  const widthClass = fullWidth ? "w-full" : "";

  const variantClasses = {
    primary: "bg-tactical-green border border-tactical-greenLight",
    secondary: "bg-tactical-mediumGray border border-tactical-border",
    danger: "bg-tactical-red border border-tactical-redLight",
    ghost: "bg-transparent border border-tactical-border",
  };

  const textVariantClasses = {
    primary: "text-tactical-text",
    secondary: "text-tactical-textMuted",
    danger: "text-tactical-text",
    ghost: "text-tactical-textMuted",
  };

  const disabledClass = disabled || loading ? "opacity-50" : "";

  return (
    <TouchableOpacity
      className={`${baseClasses} ${variantClasses[variant]} ${widthClass} ${disabledClass}`}
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={[
        {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 6,
          elevation: 8,
        },
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "ghost" ? "#A0A0A0" : "#E0E0E0"}
        />
      ) : (
        <>
          {icon && <View className="mr-3">{icon}</View>}
          <Text
            className={`text-sm font-semibold tracking-widest uppercase ${textVariantClasses[variant]}`}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}
