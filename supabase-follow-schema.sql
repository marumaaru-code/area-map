-- ================================================================
-- フォロー選定ツール 共有機能用スキーマ
-- Supabase の SQL Editor に貼り付けて「Run」してください
-- ================================================================

-- 1) チームが追加するアカウント（工務店以外のカテゴリ含む・リンク埋め込み用）
create table if not exists follow_accounts (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'その他',   -- 例: 工務店 / 家具 / リフォーム / インテリア / その他
  name text not null,
  handle text,                                -- Instagramハンドル（任意）
  link text,                                  -- 任意のリンク（Instagram/公式サイト等）
  region text,
  prefecture text,
  followers integer,
  note text,
  created_by text,                            -- 追加した人の名前
  created_at timestamptz default now()
);

-- 2) アプローチ履歴（誰がいつ・どのアカウントに）
create table if not exists follow_approaches (
  id uuid primary key default gen_random_uuid(),
  account_key text not null,                  -- 対象アカウントのハンドル（無ければ follow_accounts.id）
  account_name text,                          -- 表示用の名前
  approached_by text not null,                -- 担当者名
  approached_at date not null default current_date,  -- アプローチ時期
  method text,                                -- 例: フォロー / DM / いいね / コメント
  note text,
  created_at timestamptz default now()
);
create index if not exists idx_follow_approaches_key on follow_approaches(account_key);

-- 3) 共有コメント（全員が書けて全員に見える）
create table if not exists follow_comments (
  id uuid primary key default gen_random_uuid(),
  account_key text not null,
  account_name text,
  author text not null,                       -- 書いた人の名前
  body text not null,
  created_at timestamptz default now()
);
create index if not exists idx_follow_comments_key on follow_comments(account_key);

-- ================================================================
-- RLS（社内MVP：anon公開キーで全操作を許可）
--   ※社内限定の内部ツール前提。将来的に認証を入れる場合はポリシーを見直し
-- ================================================================
alter table follow_accounts   enable row level security;
alter table follow_approaches enable row level security;
alter table follow_comments   enable row level security;

create policy "allow all follow_accounts"   on follow_accounts   for all using (true) with check (true);
create policy "allow all follow_approaches" on follow_approaches for all using (true) with check (true);
create policy "allow all follow_comments"   on follow_comments   for all using (true) with check (true);
