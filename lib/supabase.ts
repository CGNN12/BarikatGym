import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

// ⚠️  Replace these with your actual Supabase project credentials
const SUPABASE_URL = "https://nczyzmejgrervwqvhtkb.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jenl6bWVqZ3JlcnZ3cXZodGtiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExNDgzMjEsImV4cCI6MjA4NjcyNDMyMX0.MtJOIJihZzh-BK1py-Bqm9xjXdJQAhpCWSGdp71h2r8";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
