import { createClient } from "@supabase/supabase-js";

const fallbackUrl = "https://acmtawptpngrxhxvxevp.supabase.co";
const url = import.meta.env.VITE_SUPABASE_URL ?? fallbackUrl;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(key);

export const supabase = createClient(url, key ?? "missing-publishable-key", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});
