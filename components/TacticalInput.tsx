import React, { useState } from "react";
import {
  TextInput,
  View,
  Text,
  type TextInputProps,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Eye, EyeOff } from "lucide-react-native";

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
    <View style={styles.wrapper}>
      {/* Label */}
      <Text style={styles.label}>{label}</Text>

      {/* Input Container */}
      <View
        style={[
          styles.inputContainer,
          {
            borderColor: error
              ? "#8B0000"
              : isFocused
              ? "#4B5320"
              : "#444444",
            shadowColor: isFocused ? "#4B5320" : "#000",
            shadowOpacity: isFocused ? 0.4 : 0.2,
          },
        ]}
      >
        {/* Left Icon */}
        {icon && <View style={styles.iconLeft}>{icon}</View>}

        {/* Text Input */}
        <TextInput
          style={styles.input}
          placeholderTextColor="#666666"
          selectionColor="#4B5320"
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
              <EyeOff size={20} color="#666666" />
            ) : (
              <Eye size={20} color="#A0A0A0" />
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Error Message */}
      {error && <Text style={styles.error}>⚠ {error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    marginBottom: 16,
  },
  label: {
    color: "#A0A0A0",
    fontSize: 11,
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 8,
    marginLeft: 4,
    fontWeight: "600",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E1E1E",
    borderWidth: 1.5,
    borderRadius: 3,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  iconLeft: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: "#E0E0E0",
    fontSize: 16,
    padding: 0,
  },
  error: {
    color: "#8B0000",
    fontSize: 11,
    marginTop: 6,
    marginLeft: 4,
    letterSpacing: 1,
  },
});
