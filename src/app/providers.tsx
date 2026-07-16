import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "../game/types";
import { ensureAnonymousUser, getProfile, saveProfile } from "../services/auth";
import { isSupabaseConfigured, supabase } from "../services/supabase";

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  updateProfile: (screenName: string, avatar?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AppProviders({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured) {
      setError("Scram-Bo still needs its Supabase publishable key.");
      setLoading(false);
      return;
    }

    void ensureAnonymousUser()
      .then(async (nextUser) => {
        if (!active) return;
        setUser(nextUser);
        const nextProfile = await getProfile(nextUser.id);
        setProfile(nextProfile);
        if (nextProfile?.avatar) localStorage.setItem("scrambo.profileAvatar", nextProfile.avatar);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not sign in."))
      .finally(() => setLoading(false));

    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const applyPreferences = () => {
      document.documentElement.dataset.motion = localStorage.getItem("scrambo.motionEnabled") ?? "true";
      document.documentElement.dataset.sound = localStorage.getItem("scrambo.soundEnabled") ?? "true";
    };
    applyPreferences();
    window.addEventListener("scrambo-setting", applyPreferences);
    return () => window.removeEventListener("scrambo-setting", applyPreferences);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading,
      error,
      updateProfile: async (screenName, avatar) => {
        if (!user) throw new Error("You are not signed in.");
        const updated = await saveProfile(user.id, screenName, avatar ?? profile?.avatar ?? "🦥");
        setProfile(updated);
      },
    }),
    [error, loading, profile, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AppProviders.");
  return value;
}
