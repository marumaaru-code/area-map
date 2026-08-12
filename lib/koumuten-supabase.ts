import { createClient } from "@supabase/supabase-js";

// フォロー選定ツール（koumuten-follow-tool）専用のSupabaseプロジェクト。
// area-map本体のSupabase（lib/supabase-server.ts）とは別のDBなので混同注意。
// anon(public)キー：クライアント埋め込み用の公開キー。RLSでアクセス制御。
const SUPABASE_URL = "https://xxbqpfknnnlwtlivuklt.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4YnFwZmtubm5sd3RsaXZ1a2x0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3MDUwMTAsImV4cCI6MjEwMDI4MTAxMH0.OPAq_R8BRAwXYbBaXKym_-c3lFbNzlYyu_kaW93zG-Q";

export const koumutenSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

export interface TeamAccount {
  id: string;
  category: string;
  name: string;
  handle: string | null;
  link: string | null;
  region: string | null;
  prefecture: string | null;
  followers: number | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Approach {
  id: string;
  account_key: string;
  account_name: string | null;
  approached_by: string;
  approached_at: string; // YYYY-MM-DD
  method: string | null;
  note: string | null;
  created_at: string;
}

export interface Comment {
  id: string;
  account_key: string;
  account_name: string | null;
  author: string;
  body: string;
  likes: number | null;
  created_at: string;
}
