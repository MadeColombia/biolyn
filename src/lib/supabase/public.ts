import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./env";

// Cookie-free client for public data (profile pages). Safe to use inside
// 'use cache' functions because it never reads the request.
export function createPublicClient() {
  const { url, anonKey } = supabaseEnv();
  return createClient(url, anonKey, { auth: { persistSession: false } });
}
