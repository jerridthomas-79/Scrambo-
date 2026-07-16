import type { User } from "@supabase/supabase-js";
import type { Profile } from "../game/types";
import { DEFAULT_AVATAR } from "../game/avatars";
import { validateScreenName } from "../game/rules";
import { supabase } from "./supabase";

export async function ensureAnonymousUser(): Promise<User> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.user) return sessionData.session.user;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw