// src/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.NG_SUPABASE_URL || "https://tbijwxzogmeytmelanbv.supabase.co";
const supabaseAnonKey =
  import.meta.env.NG_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRiaWp3eHpvZ21leXRtZWxhbmJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MzUyMjMsImV4cCI6MjA3MjUxMTIyM30.MvsRVQtTe5P9XKq2vuXhIpgCBYLmsy935jeEv9RL7_Q";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,   // ✅ session saved to localStorage automatically
    autoRefreshToken: true, // ✅ refresh tokens automatically
    detectSessionInUrl: true, // ✅ required for magic link
  },
});
