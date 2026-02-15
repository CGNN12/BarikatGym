// BarikatGym Tactical Theme Constants

export const COLORS = {
  // Backgrounds
  black: "#121212",
  darkGray: "#1A1A1A",
  mediumGray: "#2A2A2A",
  border: "#333333",

  // Primary Accent
  green: "#4B5320",
  greenLight: "#5C6B2A",
  greenDark: "#3A4119",

  // Text
  text: "#E0E0E0",
  textMuted: "#A0A0A0",
  textDark: "#707070",

  // Status
  red: "#8B0000",
  redLight: "#A52A2A",
  amber: "#B8860B",

  // Misc
  white: "#FFFFFF",
  transparent: "transparent",
} as const;

export const FONTS = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  black: "Inter_900Black",
} as const;

// Membership expiration warning threshold (days)
export const MEMBERSHIP_WARNING_DAYS = 7;

// Auto check-out duration (milliseconds) = 3 hours
export const AUTO_CHECKOUT_MS = 3 * 60 * 60 * 1000;

// App name
export const APP_NAME = "BARIKAT";
export const APP_SUBTITLE = "OPEN GYM";
