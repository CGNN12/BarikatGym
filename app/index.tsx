import { View, ActivityIndicator } from "react-native";

// Root index — AuthGuard in _layout.tsx handles all routing
// This just shows a loading spinner while auth state resolves
export default function Index() {
  return (
    <View style={{ flex: 1, backgroundColor: "#121212", alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator size="large" color="#4B5320" />
    </View>
  );
}
