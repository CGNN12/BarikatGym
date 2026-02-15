import { Tabs } from "expo-router";
import { LayoutDashboard, ScanLine, UserCircle } from "lucide-react-native";
import { COLORS } from "@/constants/theme";
import { View } from "react-native";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.darkGray,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: 70,
          paddingBottom: 10,
          paddingTop: 8,
          elevation: 20,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.5,
          shadowRadius: 10,
        },
        tabBarActiveTintColor: COLORS.green,
        tabBarInactiveTintColor: COLORS.textDark,
        tabBarLabelStyle: {
          fontSize: 9,
          fontFamily: "Inter_600SemiBold",
          letterSpacing: 2,
          textTransform: "uppercase",
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "MERKEZ",
          tabBarIcon: ({ color, focused }) => (
            <View
              className={`p-1.5 rounded-sm ${
                focused ? "bg-tactical-green/20" : ""
              }`}
            >
              <LayoutDashboard size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: "TARAMA",
          tabBarIcon: ({ color, focused }) => (
            <View
              className={`p-1.5 rounded-sm ${
                focused ? "bg-tactical-green/20" : ""
              }`}
            >
              <ScanLine size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "PROFİL",
          tabBarIcon: ({ color, focused }) => (
            <View
              className={`p-1.5 rounded-sm ${
                focused ? "bg-tactical-green/20" : ""
              }`}
            >
              <UserCircle size={22} color={color} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
