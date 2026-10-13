import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./env";

// Server-only client with the service role key. It skips Row Level
// Security, so only use it for the logging and rate-limit functions.
// Returns null until SUPABASE_SERVICE_ROLE_KEY is set in the environment.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(supabaseEnv().url, key, {
    auth: { persistSession: false },
  });
}
