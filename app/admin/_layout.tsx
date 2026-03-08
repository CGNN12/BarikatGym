import { Tabs } from "expo-router";
import { Dumbbell, Users, User } from "lucide-react-native";
import { COLORS } from "@/constants/theme";
import { View, Platform, StyleSheet } from "react-native";

export default function AdminTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#121212",
          borderTopWidth: 0,
          borderTopColor: "transparent",
          height: Platform.OS === "ios" ? 90 : 70,
          paddingBottom: Platform.OS === "ios" ? 25 : 12,
          paddingTop: 8,
          minHeight: 70,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarBackground: () => (
          <View style={StyleSheet.absoluteFill}>
            <View style={{ flex: 1, backgroundColor: "#121212" }} />
          </View>
        ),
        tabBarActiveTintColor: COLORS.green,
        tabBarInactiveTintColor: "#808080",
        tabBarLabelStyle: {
          fontSize: 9,
          fontFamily: "Inter_600SemiBold",
          letterSpacing: 2,
          textTransform: "uppercase",
          marginTop: 2,
          marginBottom: Platform.OS === "ios" ? 0 : 4,
        },
        sceneStyle: {
          backgroundColor: "transparent",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "MERKEZ",
          tabBarIcon: ({ color, focused }) => (
            <View
              style={
                focused
                  ? { padding: 6, borderRadius: 4, backgroundColor: "rgba(75,83,32,0.2)" }
                  : { padding: 6 }
              }
            >
              <Dumbbell size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="members"
        options={{
          title: "ÜYELER",
          tabBarIcon: ({ color, focused }) => (
            <View
              style={
                focused
                  ? { padding: 6, borderRadius: 4, backgroundColor: "rgba(75,83,32,0.2)" }
                  : { padding: 6 }
              }
            >
              <Users size={22} color={color} />
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
              style={
                focused
                  ? { padding: 6, borderRadius: 4, backgroundColor: "rgba(75,83,32,0.2)" }
                  : { padding: 6 }
              }
            >
              <User size={22} color={color} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
