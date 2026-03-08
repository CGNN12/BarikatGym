import { Tabs } from "expo-router";
import { Dumbbell, Users, User } from "lucide-react-native";
import { COLORS } from "@/constants/theme";
import { Platform } from "react-native";

const TAB_BAR_HEIGHT = Platform.OS === "ios" ? 92 : 72;

export default function AdminTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0E0E0E",
          borderTopWidth: 1,
          borderTopColor: "#1E1E1E",
          height: TAB_BAR_HEIGHT,
          paddingBottom: Platform.OS === "ios" ? 26 : 10,
          paddingTop: 10,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarActiveTintColor: COLORS.green,
        tabBarInactiveTintColor: "#505050",
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: "700",
          letterSpacing: 2,
          marginTop: 2,
        },
        sceneStyle: {
          backgroundColor: "transparent",
        },
      }}
    >
      {/* ═══════════ SOL — MERKEZ ═══════════ */}
      <Tabs.Screen
        name="index"
        options={{
          title: "MERKEZ",
          tabBarItemStyle: { paddingLeft: 16 },
          tabBarIcon: ({ color, focused }) => (
            <Dumbbell size={22} color={focused ? "#5C6B2A" : color} />
          ),
        }}
      />

      {/* ═══════════ ORTA — ÜYELER ═══════════ */}
      <Tabs.Screen
        name="members"
        options={{
          title: "ÜYELER",
          tabBarIcon: ({ color, focused }) => (
            <Users size={22} color={focused ? "#5C6B2A" : color} />
          ),
        }}
      />

      {/* ═══════════ SAĞ — PROFİL ═══════════ */}
      <Tabs.Screen
        name="profile"
        options={{
          title: "PROFİL",
          tabBarItemStyle: { paddingRight: 16 },
          tabBarIcon: ({ color, focused }) => (
            <User size={22} color={focused ? "#5C6B2A" : color} />
          ),
        }}
      />
    </Tabs>
  );
}
