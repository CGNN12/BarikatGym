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
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          // Eğer oturum hatası varsa (özellikle Invalid Refresh Token), temizlik yap
          console.warn("Auth initialization error:", error.message);
          if (error.message.includes("refresh_token") || error.status === 400) {
             await supabase.auth.signOut();
          }
          
          setAuthState({
            user: null,
            session: null,
            loading: false,
            initialized: true,
          });
          return;
        }

        setAuthState({
          user: session?.user ?? null,
          session,
          loading: false,
          initialized: true,
        });
      } catch (err) {
        console.error("Auth init exception:", err);
        setAuthState((prev) => ({ ...prev, loading: false, initialized: true }));
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // console.log("Auth state change:", event);
      
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
    async (email: string, password: string, fullName: string, role: string = "member") => {
      try {
        setAuthState((prev) => ({ ...prev, loading: true }));

        // 1. Sign up user
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, role },
          },
        });

        if (error) throw new Error(error.message); // Hata mesajını string olarak fırlat

        if (data.user) {
          // Profil oluştur — tarih bilgisi GÖNDERME, admin onaylayana kadar null kalacak
          await supabase.from("profiles").upsert({
            id: data.user.id,
            full_name: fullName,
            role,
            status: "inactive",
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
