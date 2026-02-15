/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        tactical: {
          black: "#121212",
          darkGray: "#1A1A1A",
          mediumGray: "#2A2A2A",
          border: "#333333",
          green: "#4B5320",
          greenLight: "#5C6B2A",
          greenDark: "#3A4119",
          text: "#E0E0E0",
          textMuted: "#A0A0A0",
          textDark: "#707070",
          red: "#8B0000",
          redLight: "#A52A2A",
          amber: "#B8860B",
        },
      },
      fontFamily: {
        sans: ["Inter_400Regular"],
        medium: ["Inter_500Medium"],
        semibold: ["Inter_600SemiBold"],
        bold: ["Inter_700Bold"],
        black: ["Inter_900Black"],
      },
    },
  },
  plugins: [],
};
