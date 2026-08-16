import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// If Supabase isn't configured yet, `supabase` is null and the app falls
// back to localStorage automatically (see src/storage.js). This means the
// app works immediately after deploy — Supabase is an upgrade for
// cross-device / cross-session persistence, not a requirement to ship.
export const supabase = url && anonKey ? createClient(url, anonKey) : null;
