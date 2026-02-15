import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Session, User } from "@supabase/supabase-js";

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    initialized: false,
  });

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthState({
        user: session?.user ?? null,
        session,
        loading: false,
        initialized: true,
      });
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthState({
        user: session?.user ?? null,
        session,
        loading: false,
        initialized: true,
      });
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setAuthState((prev) => ({ ...prev, loading: true }));
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setAuthState((prev) => ({ ...prev, loading: false }));
      throw error;
    }
    return data;
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, fullName: string) => {
      setAuthState((prev) => ({ ...prev, loading: true }));
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        },
      });
      if (error) {
        setAuthState((prev) => ({ ...prev, loading: false }));
        throw error;
      }
      return data;
    },
    [],
  );

  const signOut = useCallback(async () => {
    setAuthState((prev) => ({ ...prev, loading: true }));
    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthState((prev) => ({ ...prev, loading: false }));
      throw error;
    }
  }, []);

  return {
    ...authState,
    signIn,
    signUp,
    signOut,
  };
}
