import React, { useState } from "react";
import {
  TextInput,
  View,
  Text,
  type TextInputProps,
  TouchableOpacity,
} from "react-native";
import { Eye, EyeOff } from "lucide-react-native";
import { COLORS } from "@/constants/theme";

interface TacticalInputProps extends TextInputProps {
  label: string;
  error?: string;
  icon?: React.ReactNode;
}

export default function TacticalInput({
  label,
  error,
  icon,
  secureTextEntry,
  ...props
}: TacticalInputProps) {
  const [isSecure, setIsSecure] = useState(secureTextEntry);
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View className="w-full mb-4">
      {/* Label */}
      <Text className="text-tactical-textMuted text-xs tracking-widest uppercase mb-2 ml-1">
        {label}
      </Text>

      {/* Input Container */}
      <View
        className={`flex-row items-center bg-tactical-darkGray border rounded-sm px-4 py-3 ${
          error
            ? "border-tactical-red"
            : isFocused
            ? "border-tactical-green"
            : "border-tactical-border"
        }`}
        style={{
          shadowColor: isFocused ? "#4B5320" : "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isFocused ? 0.3 : 0.2,
          shadowRadius: 4,
          elevation: isFocused ? 4 : 2,
        }}
      >
        {/* Left Icon */}
        {icon && <View className="mr-3">{icon}</View>}

        {/* Text Input */}
        <TextInput
          className="flex-1 text-tactical-text text-base"
          placeholderTextColor={COLORS.textDark}
          secureTextEntry={isSecure}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          autoCapitalize="none"
          {...props}
        />

        {/* Password Toggle */}
        {secureTextEntry && (
          <TouchableOpacity
            onPress={() => setIsSecure(!isSecure)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {isSecure ? (
              <EyeOff size={20} color={COLORS.textDark} />
            ) : (
              <Eye size={20} color={COLORS.textMuted} />
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Error Message */}
      {error && (
        <Text className="text-tactical-red text-xs mt-1 ml-1 tracking-wide">
          ⚠ {error}
        </Text>
      )}
    </View>
  );
}
