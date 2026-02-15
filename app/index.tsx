import { Redirect } from "expo-router";
import { useAuth } from "@/hooks/useAuth";
import { View, ActivityIndicator } from "react-native";

export default function Index() {
  const { user, initialized } = useAuth();

  if (!initialized) {
    return (
      <View className="flex-1 bg-tactical-black items-center justify-center">
        <ActivityIndicator size="large" color="#4B5320" />
      </View>
    );
  }

  if (user) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  return <Redirect href="/(auth)/login" />;
}
