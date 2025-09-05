// src/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

// Your project URL + anon key (from env or fallback)
const supabaseUrl =
  import.meta.env.NG_SUPABASE_URL || 'https://tbijwxzogmeytmelanbv.supabase.co';
const supabaseAnonKey =
  import.meta.env.NG_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRiaWp3eHpvZ21leXRtZWxhbmJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MzUyMjMsImV4cCI6MjA3MjUxMTIyM30.MvsRVQtTe5P9XKq2vuXhIpgCBYLmsy935jeEv9RL7_Q';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: async (url, options: any = {}) => {
      const token = localStorage.getItem('auth0_access_token');

      // ✅ Always enforce JSON + apikey
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        ...(options.headers || {}),
      };

      // ✅ If logged in, override with Auth0 JWT
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      return fetch(url, { ...options, headers });
    },
  },
});
