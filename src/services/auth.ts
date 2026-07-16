import type { User } from "@supabase/supabase-js";
import type { Profile } from "../game/types";
import { validateScreenName } from "../game/rules";
import { supabase } from "./supabase";

export async function ensureAnonymousUser(): Promise<User> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.user) return sessionData.session.user;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  if (!data.user) throw new Error("Anonymous sign-in did not return a user.");
  return data.user;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function saveProfile(userId: string, screenName: string, avatar = "🦥"): Promise<Profile> {
  const errorMessage = validateScreenName(screenName);
  if (errorMessage) throw new Error(errorMessage);
  const cleanName = screenName.trim();
  const { data, error } = await supabase
    .from("profiles")
    .upsert({ id: userId, screen_name: cleanName, avatar })
    .select("*")
    .single();
  if (error) throw error;
  localStorage.setItem("scrambo.profileName", cleanName);
  localStorage.setItem("scrambo.profileAvatar", avatar);
  return data as Profile;
}
