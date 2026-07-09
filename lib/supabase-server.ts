import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-side Supabase client. Uses the SECRET key, which bypasses Row Level
// Security — so it must NEVER be imported into a client component. Only the
// /api/* route handlers import this module.
//
// The browser talks only to our /api/* routes; those routes use this client.
// That way the powerful key never ships to the browser and the database is not
// world-writable via the public/publishable key.

let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !url.startsWith("https://") || !secret) {
    throw new Error(
      "Supabase server env not configured — set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local"
    );
  }
  cached = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export const errMessage = (e: unknown): string =>
  e instanceof Error ? e.message : String(e);
