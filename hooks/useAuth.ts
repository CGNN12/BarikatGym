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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthState({
        user: session?.user ?? null,
        session,
        loading: false,
        initialized: true,
      });
    });

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
    try {
      setAuthState((prev) => ({ ...prev, loading: true }));
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw new Error(error.message); // Hata mesajını string olarak fırlat
      return data;
    } catch (err: any) {
      setAuthState((prev) => ({ ...prev, loading: false }));
      throw new Error(err?.message || "Giriş yapılamadı");
    } finally {
      setAuthState((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, fullName: string) => {
      try {
        setAuthState((prev) => ({ ...prev, loading: true }));

        // 1. Sign up user
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
          },
        });

        if (error) throw new Error(error.message); // Hata mesajını string olarak fırlat

        if (data.user) {
          // Trigger çalışmazsa diye manuel profil oluşturma
          await supabase.from("profiles").upsert({
            id: data.user.id,
            full_name: fullName,
            updated_at: new Date().toISOString(),
          });
        }

        return data;
      } catch (err: any) {
        setAuthState((prev) => ({ ...prev, loading: false }));
        // Hatayı string olarak fırlatıyoruz ki login.tsx'de type error olmasın
        throw new Error(err?.message || "Kayıt işlemi başarısız");
      } finally {
        setAuthState((prev) => ({ ...prev, loading: false }));
      }
    },
    [],
  );

  const signOut = useCallback(async () => {
    setAuthState((prev) => ({ ...prev, loading: true }));
    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthState((prev) => ({ ...prev, loading: false }));
      throw new Error(error.message);
    }
    setAuthState((prev) => ({ ...prev, loading: false }));
  }, []);

  return {
    ...authState,
    signIn,
    signUp,
    signOut,
  };
}
