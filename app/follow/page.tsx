"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import rawData from "@/lib/koumuten-data.json";
import { koumutenSupabase as supabase, type TeamAccount, type Approach, type Comment } from "@/lib/koumuten-supabase";

interface Account {
  followers: number | null;
  name: string | null;
  handle: string | null;
  status: string | null;
  atmosphere: string[];
  product: string[];
  target: string[];
  region: string | null;
  prefecture: string | null;
  prefectures: string[];
  regions: string[];
  locs: [string, string][];
  source: string;      // "sho-san" | "builders-ranking" | "team"
  category: string;    // "工務店" など
  link?: string | null;
  teamId?: string;
}

const DATA = rawData as unknown as Account[];

const REGION_ORDER = ["関東", "中部", "関西", "中国", "四国", "九州", "東北", "北海道"];
const PREF_REGION: Record<string, string> = {
  北海道: "北海道", 青森: "東北", 岩手: "東北", 宮城: "東北", 秋田: "東北", 山形: "東北", 福島: "東北",
  茨城: "関東", 栃木: "関東", 群馬: "関東", 埼玉: "関東", 千葉: "関東", 東京: "関東", 神奈川: "関東",
  新潟: "中部", 富山: "中部", 石川: "中部", 福井: "中部", 山梨: "中部", 長野: "中部", 岐阜: "中部", 静岡: "中部", 愛知: "中部",
  三重: "関西", 滋賀: "関西", 京都: "関西", 大阪: "関西", 兵庫: "関西", 奈良: "関西", 和歌山: "関西",
  鳥取: "中国", 島根: "中国", 岡山: "中国", 広島: "中国", 山口: "中国",
  徳島: "四国", 香川: "四国", 愛媛: "四国", 高知: "四国",
  福岡: "九州", 佐賀: "九州", 長崎: "九州", 熊本: "九州", 大分: "九州", 宮崎: "九州", 鹿児島: "九州", 沖縄: "九州",
};

const ATMOSPHERE_TAGS = ["ナチュラル", "モダン", "シック", "北欧風", "カントリー", "和モダン", "木目調", "ホテルライク", "カフェライク", "南欧風", "リゾート風", "西海岸風"];
const PRODUCT_TAGS = ["平屋", "リフォーム", "リノベーション", "規格住宅", "分譲住宅", "省エネ住宅", "エコ"];
const TARGET_TAGS = ["子育て", "ペット", "家事ラク系", "狭小地"];
const APPROACH_METHODS = ["フォロー", "いいね", "DM", "コメント", "その他"];
const RATINGS = ["良", "普通", "悪"];
const RATING_STYLE: Record<string, string> = { 良: "bg-green-100 text-green-700", 普通: "bg-gray-200 text-gray-600", 悪: "bg-red-100 text-red-700" };

const FOLLOWER_RANGES = [
  { key: "lt2k", label: "2,000人未満", min: 0, max: 1999 },
  { key: "2k", label: "2,000〜5,000", min: 2000, max: 4999 },
  { key: "5k", label: "5,000〜10,000", min: 5000, max: 9999 },
  { key: "10k", label: "10,000以上", min: 10000, max: Infinity },
];

const SHOSAN = "sho-san";
const BR = "builders-ranking";
const TEAM = "team";
const W = 2;
const NAME_KEY = "follow-tool-username";

function toggle(arr: string[], v: string) { return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]; }
function keyOf(a: Account) { return a.handle || (a.teamId ? `id:${a.teamId}` : `name:${a.name}`); }
function igUrlOf(a: Account) { return a.link || (a.handle ? `https://www.instagram.com/${a.handle}/` : null); }
function relTime(iso: string) {
  const d = new Date(iso).getTime(); const now = Date.now();
  const days = Math.floor((now - d) / 86400000);
  if (days <= 0) return "今日";
  if (days === 1) return "昨日";
  if (days < 30) return `${days}日前`;
  const m = Math.floor(days / 30);
  if (m < 12) return `${m}ヶ月前`;
  return `${Math.floor(m / 12)}年前`;
}

export default function FollowPage() {
  const [username, setUsername] = useState("");
  const [teamAccounts, setTeamAccounts] = useState<Account[]>([]);
  const [recent, setRecent] = useState<Comment[]>([]);
  const [showRecent, setShowRecent] = useState(false);

  // filters
  const [category, setCategory] = useState("");
  const [source, setSource] = useState("");
  const [followerRange, setFollowerRange] = useState("");
  const [region, setRegion] = useState("");
  const [pref, setPref] = useState("");
  const [city, setCity] = useState("");
  const [keyword, setKeyword] = useState("");
  const [atmosphere, setAtmosphere] = useState<string[]>([]);
  const [product, setProduct] = useState<string[]>([]);
  const [target, setTarget] = useState<string[]>([]);

  const [selected, setSelected] = useState<Account | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [sortKey, setSortKey] = useState(""); // "" | foll_desc | foll_asc | name

  useEffect(() => {
    try { setUsername(localStorage.getItem(NAME_KEY) || ""); } catch {}
    loadTeam();
    loadRecent();
    loadStats();
  }, []);

  function saveUsername(v: string) { setUsername(v); try { localStorage.setItem(NAME_KEY, v); } catch {} }

  const loadTeam = useCallback(async () => {
    const { data } = await supabase.from("follow_accounts").select("*").order("created_at", { ascending: false });
    if (!data) return;
    setTeamAccounts((data as TeamAccount[]).map((t) => {
      const prefs = t.prefecture ? [t.prefecture.replace(/[都道府県]$/, "")] : [];
      const regs = prefs.map((p) => PREF_REGION[p]).filter(Boolean) as string[];
      return {
        followers: t.followers, name: t.name, handle: t.handle, status: "チーム追加",
        atmosphere: [], product: [], target: [], region: t.region || regs[0] || null,
        prefecture: t.prefecture, prefectures: prefs, regions: regs, locs: [],
        source: TEAM, category: t.category || "その他", link: t.link, teamId: t.id,
      };
    }));
  }, []);

  const loadRecent = useCallback(async () => {
    const { data } = await supabase.from("follow_comments").select("*").order("created_at", { ascending: false }).limit(20);
    if (data) setRecent(data as Comment[]);
  }, []);

  // アカウント横断のコメント集計（並べ替え「コメント多い順」「バック率高い順」用）
  const [stats, setStats] = useState<Record<string, { count: number; rateScore: number }>>({});
  const loadStats = useCallback(async () => {
    const { data } = await supabase.from("follow_comments").select("account_key, rating");
    if (!data) return;
    const RV: Record<string, number> = { 良: 3, 普通: 2, 悪: 1 };
    const acc: Record<string, { count: number; sum: number; rated: number }> = {};
    for (const c of data as { account_key: string; rating: string | null }[]) {
      const a = acc[c.account_key] || (acc[c.account_key] = { count: 0, sum: 0, rated: 0 });
      a.count++;
      if (c.rating && RV[c.rating]) { a.sum += RV[c.rating]; a.rated++; }
    }
    const out: Record<string, { count: number; rateScore: number }> = {};
    for (const [k, a] of Object.entries(acc)) out[k] = { count: a.count, rateScore: a.rated ? a.sum / a.rated : -1 };
    setStats(out);
  }, []);
  const refreshShared = useCallback(() => { loadRecent(); loadStats(); }, [loadRecent, loadStats]);

  const allAccounts = useMemo(() => [...DATA, ...teamAccounts], [teamAccounts]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>(["工務店"]);
    teamAccounts.forEach((t) => set.add(t.category));
    return Array.from(set);
  }, [teamAccounts]);

  const tree = useMemo(() => {
    const t: Record<string, Record<string, Set<string>>> = {};
    for (const k of allAccounts) {
      for (const p of k.prefectures) {
        const r = PREF_REGION[p]; if (!r) continue;
        t[r] = t[r] || {}; t[r][p] = t[r][p] || new Set();
      }
      for (const [p, c] of k.locs) {
        const r = PREF_REGION[p]; if (!r) continue;
        t[r] = t[r] || {}; t[r][p] = t[r][p] || new Set(); t[r][p].add(c);
      }
    }
    return t;
  }, [allAccounts]);

  const regionOptions = REGION_ORDER.filter((r) => tree[r]);
  const prefOptions = region && tree[region] ? Object.keys(tree[region]).sort() : [];
  const cityOptions = region && pref && tree[region]?.[pref] ? Array.from(tree[region][pref]).sort() : [];

  const hasTagFilter = atmosphere.length + product.length + target.length > 0;

  const results = useMemo(() => {
    const maxScore = (atmosphere.length + product.length + target.length) * W;
    const kw = keyword.trim();
    const fr = FOLLOWER_RANGES.find((r) => r.key === followerRange);
    const list = allAccounts.filter((k) => {
      if (category && k.category !== category) return false;
      if (source && k.source !== source) return false;
      if (fr && !(k.followers != null && k.followers >= fr.min && k.followers <= fr.max)) return false;
      if (region && !k.regions.includes(region)) return false;
      if (pref && !k.prefectures.includes(pref)) return false;
      if (city && !k.locs.some(([, c]) => c === city)) return false;
      if (kw && !(k.prefecture || "").includes(kw) && !(k.name || "").includes(kw)) return false;
      return true;
    });
    const scored = list.map((k) => {
      const mA = atmosphere.filter((t) => k.atmosphere.includes(t));
      const mP = product.filter((t) => k.product.includes(t));
      const mT = target.filter((t) => k.target.includes(t));
      const score = (mA.length + mP.length + mT.length) * W;
      return { k, score, maxScore, matched: [...mA, ...mP, ...mT] };
    });
    const st = (k: Account) => stats[keyOf(k)] || { count: 0, rateScore: -1 };
    scored.sort((a, b) => {
      if (sortKey === "foll_desc") return (b.k.followers || 0) - (a.k.followers || 0);
      if (sortKey === "foll_asc") return (a.k.followers || 0) - (b.k.followers || 0);
      if (sortKey === "name") return (a.k.name || "").localeCompare(b.k.name || "", "ja");
      if (sortKey === "rating") { const d = st(b.k).rateScore - st(a.k).rateScore; return d !== 0 ? d : (b.k.followers || 0) - (a.k.followers || 0); }
      if (sortKey === "comments") { const d = st(b.k).count - st(a.k).count; return d !== 0 ? d : (b.k.followers || 0) - (a.k.followers || 0); }
      return (hasTagFilter && b.score !== a.score) ? b.score - a.score : (b.k.followers || 0) - (a.k.followers || 0);
    });
    return hasTagFilter ? scored.filter((s) => s.score > 0) : scored;
  }, [allAccounts, category, source, followerRange, region, pref, city, keyword, atmosphere, product, target, hasTagFilter, sortKey, stats]);

  const hasFilter = !!(category || source || followerRange || region || pref || city || keyword.trim() || hasTagFilter);
  function resetAll() {
    setCategory(""); setSource(""); setFollowerRange(""); setRegion(""); setPref(""); setCity(""); setKeyword("");
    setAtmosphere([]); setProduct([]); setTarget([]);
  }

  const shosanCount = DATA.filter((k) => k.source === SHOSAN).length;
  const brCount = DATA.filter((k) => k.source === BR).length;

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-5 sm:py-6 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-800 mb-1">フォロー選定先の提案</h1>
          <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">
            対象・エリア・テイストで絞り込み → アカウントを選ぶと詳細・アプローチ履歴・コメントが見られます。
            <span className="text-gray-400">（工務店 {shosanCount + brCount}＋チーム追加）</span>
          </p>
        </div>
      </div>

      {/* 名前設定 + みんなのコメント + 追加 */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <label className="flex items-center gap-1 text-gray-500">
          あなたの名前
          <input value={username} onChange={(e) => saveUsername(e.target.value)} placeholder="担当者名"
            className="border rounded px-2 py-1 w-28 text-gray-700" />
        </label>
        <button onClick={() => { setShowRecent((s) => !s); loadRecent(); }}
          className="border rounded-full px-3 py-1 text-gray-600 hover:bg-gray-50">💬 みんなのコメント</button>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1 bg-teal-600 text-white font-semibold rounded-full px-4 py-1.5 shadow-sm hover:bg-teal-700 active:bg-teal-800 transition-colors">
          <span className="text-sm leading-none">＋</span>アカウント追加（工務店以外もOK）
        </button>
      </div>

      {showRecent && (
        <div className="bg-white border rounded-xl p-3 max-h-72 overflow-y-auto">
          <p className="text-xs font-semibold text-gray-600 mb-2">最近のコメント</p>
          {recent.length === 0 ? <p className="text-xs text-gray-400">まだコメントはありません。</p> : (
            <ul className="space-y-2">
              {recent.map((c) => (
                <li key={c.id} className="text-xs border-b last:border-0 pb-2">
                  <button onClick={() => openByKey(c.account_key, c.account_name)} className="font-medium text-blue-600 hover:underline">{c.account_name || c.account_key}</button>
                  {c.rating && <span className={`ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold ${RATING_STYLE[c.rating] || "bg-gray-100 text-gray-600"}`}>{c.rating}</span>}
                  <span className="text-gray-400 ml-2">{c.author}・{relTime(c.created_at)}</span>
                  {c.body && <p className="text-gray-700 mt-0.5 whitespace-pre-wrap">{c.body}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* フィルタ */}
      <div className="bg-white border rounded-xl p-3.5 sm:p-4 space-y-4">
        <ChipRow label="カテゴリ">
          <Chip active={category === ""} onClick={() => setCategory("")}>すべて</Chip>
          {categoryOptions.map((c) => <Chip key={c} active={category === c} onClick={() => setCategory(c)} color="teal">{c}</Chip>)}
        </ChipRow>

        {(category === "" || category === "工務店") && (
          <ChipRow label="対象（工務店データ）">
            <Chip active={source === ""} onClick={() => setSource("")}>すべて</Chip>
            <Chip active={source === SHOSAN} onClick={() => setSource(SHOSAN)} color="teal">SHO-SAN運用中 ({shosanCount})</Chip>
            <Chip active={source === BR} onClick={() => setSource(BR)} color="slate">他社候補 ({brCount})</Chip>
          </ChipRow>
        )}

        <ChipRow label="規模（フォロワー数）">
          <Chip active={followerRange === ""} onClick={() => setFollowerRange("")}>すべて</Chip>
          {FOLLOWER_RANGES.map((r) => <Chip key={r.key} active={followerRange === r.key} onClick={() => setFollowerRange(r.key)} color="violet">{r.label}</Chip>)}
        </ChipRow>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-2">エリアで絞り込む（地域 → 県 → 市）</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Select value={region} onChange={(v) => { setRegion(v); setPref(""); setCity(""); }} placeholder="地域を選択">
              {regionOptions.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
            <Select value={pref} onChange={(v) => { setPref(v); setCity(""); }} placeholder={region ? "県（すべて）" : "先に地域"} disabled={!region}>
              {prefOptions.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
            <Select value={city} onChange={setCity} placeholder={pref ? (cityOptions.length ? "市（すべて）" : "市データなし") : "先に県"} disabled={!pref || !cityOptions.length}>
              {cityOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="エリア名・会社名でも検索（例：湘南、名古屋…）"
            className="mt-2 w-full border rounded-lg px-3 py-2 text-base sm:text-sm" />
        </div>

        {/* 詳細検索（テイスト等）はトグルで開閉 */}
        <div className="border-t pt-3">
          <button onClick={() => setShowDetail((s) => !s)} className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
            <span className="text-gray-400">{showDetail ? "▼" : "▶"}</span>
            詳細検索（テイスト・商品・ターゲット層）
            {hasTagFilter && <span className="text-[10px] bg-emerald-100 text-emerald-700 rounded-full px-1.5 py-0.5">{atmosphere.length + product.length + target.length}件選択中</span>}
          </button>
          {showDetail && (
            <div className="space-y-4 mt-3">
              <TagGroup label="雰囲気・テイスト" hint="※工務店データのみ" tags={ATMOSPHERE_TAGS} selected={atmosphere} onToggle={(t) => setAtmosphere((p) => toggle(p, t))} color="emerald" />
              <TagGroup label="商品・工法" tags={PRODUCT_TAGS} selected={product} onToggle={(t) => setProduct((p) => toggle(p, t))} color="amber" />
              <TagGroup label="想定ターゲット層" hint="※性別データが無いため訴求層タグで代替" tags={TARGET_TAGS} selected={target} onToggle={(t) => setTarget((p) => toggle(p, t))} color="pink" />
            </div>
          )}
        </div>

        {hasFilter && <div className="flex justify-end pt-2 border-t"><button onClick={resetAll} className="text-xs text-gray-400 hover:text-gray-600 underline">リセット</button></div>}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3 gap-2">
          <h2 className="font-semibold text-gray-700 text-sm">
            {hasTagFilter && !sortKey ? "おすすめ（一致度順）" : "該当アカウント"}
            <span className="text-xs text-gray-400 font-normal ml-1.5">{results.length}件</span>
          </h2>
          <div className="relative">
            <select value={sortKey} onChange={(e) => setSortKey(e.target.value)}
              className="appearance-none border rounded-lg pl-2.5 pr-7 py-1.5 text-xs bg-white text-gray-600">
              <option value="">並べ替え：おすすめ順</option>
              <option value="foll_desc">フォロワー数：多い順</option>
              <option value="foll_asc">フォロワー数：少ない順</option>
              <option value="rating">バック率：高い順</option>
              <option value="comments">コメント：多い順</option>
              <option value="name">名前順（あいうえお）</option>
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]">▼</span>
          </div>
        </div>
        {results.length === 0 ? (
          <div className="bg-gray-50 border border-dashed rounded-xl px-4 py-10 text-center text-sm text-gray-400">条件に一致するアカウントがありません。</div>
        ) : (
          <div className="space-y-2.5">
            {results.slice(0, 300).map((s, i) => (
              <ResultCard key={keyOf(s.k) + i} a={s.k} rank={i + 1} matched={hasTagFilter ? s.matched : []} stat={stats[keyOf(s.k)]} onClick={() => setSelected(s.k)} />
            ))}
            {results.length > 300 && <p className="text-center text-xs text-gray-400 py-2">上位300件を表示中（絞り込むと精度が上がります）</p>}
          </div>
        )}
      </div>

      {selected && <DetailModal account={selected} username={username} onClose={() => setSelected(null)} onChanged={refreshShared} onDeleted={() => { setSelected(null); loadTeam(); refreshShared(); }} />}
      {showAdd && <AddAccountModal username={username} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); loadTeam(); }} />}
    </div>
  );

  function openByKey(key: string, name: string | null) {
    const found = allAccounts.find((a) => keyOf(a) === key);
    if (found) { setShowRecent(false); setSelected(found); return; }
    // 見つからない場合は最小情報でモーダルを開く
    setShowRecent(false);
    setSelected({ followers: null, name: name || key, handle: key.startsWith("id:") || key.startsWith("name:") ? null : key,
      status: "", atmosphere: [], product: [], target: [], region: null, prefecture: null,
      prefectures: [], regions: [], locs: [], source: TEAM, category: "その他" });
  }
}

// ---------------- 詳細モーダル ----------------
function DetailModal({ account, username, onClose, onChanged, onDeleted }: { account: Account; username: string; onClose: () => void; onChanged: () => void; onDeleted: () => void }) {
  const key = keyOf(account);
  const [approaches, setApproaches] = useState<Approach[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [who, setWho] = useState(username);
  const [when, setWhen] = useState(() => new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState("フォロー");
  const [aNote, setANote] = useState("");
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState("");
  const [busy, setBusy] = useState(false);
  const [likedIds, setLikedIds] = useState<string[]>([]);
  const igUrl = igUrlOf(account);

  useEffect(() => {
    try { setLikedIds(JSON.parse(localStorage.getItem("follow-tool-liked") || "[]")); } catch {}
  }, []);
  function persistLiked(ids: string[]) { setLikedIds(ids); try { localStorage.setItem("follow-tool-liked", JSON.stringify(ids)); } catch {} }

  async function toggleLike(c: Comment) {
    const liked = likedIds.includes(c.id);
    const next = Math.max(0, (c.likes || 0) + (liked ? -1 : 1));
    // 楽観的更新
    setComments((prev) => prev.map((x) => x.id === c.id ? { ...x, likes: next } : x));
    persistLiked(liked ? likedIds.filter((id) => id !== c.id) : [...likedIds, c.id]);
    await supabase.from("follow_comments").update({ likes: next }).eq("id", c.id);
  }

  const load = useCallback(async () => {
    const [ap, cm] = await Promise.all([
      supabase.from("follow_approaches").select("*").eq("account_key", key).order("approached_at", { ascending: false }),
      supabase.from("follow_comments").select("*").eq("account_key", key).order("created_at", { ascending: false }),
    ]);
    if (ap.data) setApproaches(ap.data as Approach[]);
    if (cm.data) setComments(cm.data as Comment[]);
  }, [key]);
  useEffect(() => { load(); }, [load]);

  async function addApproach() {
    if (!who.trim()) return alert("あなたの名前を入力してください（画面上部）。");
    setBusy(true);
    await supabase.from("follow_approaches").insert({ account_key: key, account_name: account.name, approached_by: who.trim(), approached_at: when, method, note: aNote.trim() || null });
    setANote(""); setBusy(false); load();
  }
  async function addComment() {
    if (!comment.trim() && !rating) return;
    if (!who.trim()) return alert("あなたの名前を入力してください（画面上部）。");
    setBusy(true);
    await supabase.from("follow_comments").insert({ account_key: key, account_name: account.name, author: who.trim(), body: comment.trim(), rating: rating || null });
    setComment(""); setRating(""); setBusy(false); load(); onChanged();
  }
  async function delApproach(id: string) { await supabase.from("follow_approaches").delete().eq("id", id); load(); }
  async function delComment(id: string) { await supabase.from("follow_comments").delete().eq("id", id); load(); onChanged(); }

  // チーム追加アカウントの削除（履歴・コメントも一緒に削除）
  async function deleteAccount() {
    if (!account.teamId) return;
    if (!window.confirm(`「${account.name}」を本当に消去しますか？\nこのアカウントに紐づくアプローチ履歴・コメントも一緒に削除されます。この操作は元に戻せません。`)) return;
    setBusy(true);
    await supabase.from("follow_approaches").delete().eq("account_key", key);
    await supabase.from("follow_comments").delete().eq("account_key", key);
    await supabase.from("follow_accounts").delete().eq("id", account.teamId);
    setBusy(false);
    onDeleted();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="font-bold text-gray-800 text-sm">{account.name}</p>
              {account.source === SHOSAN && <Badge c="teal">SHO-SAN運用</Badge>}
              {account.source === BR && <Badge c="slate">他社候補</Badge>}
              {account.source === TEAM && <Badge c="teal">チーム追加</Badge>}
              {account.category && account.category !== "工務店" && <Badge c="indigo">{account.category}</Badge>}
            </div>
            <div className="flex flex-wrap gap-x-3 text-xs text-gray-500 mt-0.5">
              {account.followers != null && <span>フォロワー {account.followers.toLocaleString()}人</span>}
              {account.prefecture && <span>{account.prefecture}</span>}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none flex-shrink-0">×</button>
        </div>

        <div className="p-4 space-y-5">
          {(account.atmosphere.length + account.product.length + account.target.length > 0) && (
            <div className="flex flex-wrap gap-1">
              {[...account.atmosphere, ...account.product, ...account.target].map((t, i) => <span key={i} className="text-[10px] bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">{t}</span>)}
            </div>
          )}
          {igUrl && <a href={igUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-xs text-pink-600 font-medium">Instagram / リンクを開く →</a>}

          {/* アプローチ履歴 */}
          <section>
            <h3 className="text-xs font-bold text-gray-700 mb-2">📮 アプローチ履歴（{approaches.length}）</h3>
            <div className="space-y-1.5 mb-3">
              {approaches.length === 0 && <p className="text-xs text-gray-400">まだ記録がありません。</p>}
              {approaches.map((a) => (
                <div key={a.id} className="flex items-start gap-2 text-xs bg-gray-50 rounded-lg px-2.5 py-1.5">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-gray-700">{a.approached_by}</span>
                    <span className="text-teal-700 ml-1.5">{a.method}</span>
                    <span className="text-gray-400 ml-1.5">{a.approached_at}（{relTime(a.approached_at)}）</span>
                    {a.note && <p className="text-gray-500 mt-0.5">{a.note}</p>}
                  </div>
                  <button onClick={() => delApproach(a.id)} className="text-gray-300 hover:text-red-500">×</button>
                </div>
              ))}
            </div>
            <div className="bg-teal-50/50 border border-teal-100 rounded-lg p-2.5 space-y-2">
              <div className="flex gap-2">
                <input value={who} onChange={(e) => setWho(e.target.value)} placeholder="担当者名" className="border rounded px-2 py-1 text-xs w-24" />
                <input type="date" value={when} onChange={(e) => setWhen(e.target.value)} className="border rounded px-2 py-1 text-xs flex-1" />
                <select value={method} onChange={(e) => setMethod(e.target.value)} className="border rounded px-2 py-1 text-xs">
                  {APPROACH_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <input value={aNote} onChange={(e) => setANote(e.target.value)} placeholder="メモ（任意）" className="border rounded px-2 py-1 text-xs flex-1" />
                <button onClick={addApproach} disabled={busy} className="bg-teal-600 text-white text-xs px-3 rounded disabled:opacity-50">記録</button>
              </div>
            </div>
          </section>

          {/* コメント */}
          <section>
            <h3 className="text-xs font-bold text-gray-700 mb-2">💬 コメント（{comments.length}）<span className="font-normal text-gray-400">・全員に見えます</span></h3>
            <div className="space-y-1.5 mb-3">
              {comments.length === 0 && <p className="text-xs text-gray-400">まだコメントはありません。</p>}
              {comments.map((c) => (
                <div key={c.id} className="flex items-start gap-2 text-xs bg-gray-50 rounded-lg px-2.5 py-1.5">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-gray-700">{c.author}</span>
                    {c.rating && <span className={`ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold ${RATING_STYLE[c.rating] || "bg-gray-100 text-gray-600"}`}>バック率 {c.rating}</span>}
                    <span className="text-gray-400 ml-1.5">{relTime(c.created_at)}</span>
                    {c.body && <p className="text-gray-600 mt-0.5 whitespace-pre-wrap">{c.body}</p>}
                  </div>
                  <button onClick={() => toggleLike(c)}
                    className={`flex items-center gap-0.5 flex-shrink-0 ${likedIds.includes(c.id) ? "text-pink-600" : "text-gray-400 hover:text-pink-500"}`}>
                    <span>{likedIds.includes(c.id) ? "♥" : "♡"}</span>
                    <span className="tabular-nums">{c.likes || 0}</span>
                  </button>
                  <button onClick={() => delComment(c.id)} className="text-gray-300 hover:text-red-500 flex-shrink-0">×</button>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-gray-500">バック率</span>
                {RATINGS.map((r) => (
                  <button key={r} onClick={() => setRating((cur) => cur === r ? "" : r)}
                    className={`text-xs px-2.5 py-1 rounded-full border ${rating === r ? RATING_STYLE[r] + " border-transparent font-bold" : "bg-white text-gray-500 border-gray-200"}`}>{r}</button>
                ))}
                <span className="text-[10px] text-gray-400">（任意）</span>
              </div>
              <div className="flex gap-2">
                <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="コメントを追加…" className="border rounded px-2 py-1.5 text-xs flex-1"
                  onKeyDown={(e) => { if (e.key === "Enter") addComment(); }} />
                <button onClick={addComment} disabled={busy} className="bg-blue-600 text-white text-xs px-3 rounded disabled:opacity-50">投稿</button>
              </div>
            </div>
          </section>

          {/* チーム追加アカウントのみ削除可 */}
          {account.teamId && (
            <section className="border-t pt-4">
              <button onClick={deleteAccount} disabled={busy}
                className="w-full border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 text-xs font-medium py-2 rounded-lg">
                🗑 このアカウントを削除する
              </button>
              <p className="text-[10px] text-gray-400 mt-1 text-center">※チームで追加したアカウントのみ削除できます（履歴・コメントも消えます）</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------- アカウント追加モーダル ----------------
function AddAccountModal({ username, onClose, onSaved }: { username: string; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ category: "その他", name: "", handle: "", link: "", region: "", prefecture: "", followers: "", note: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  async function save() {
    if (!f.name.trim()) return alert("名前を入力してください。");
    setBusy(true);
    await supabase.from("follow_accounts").insert({
      category: f.category.trim() || "その他", name: f.name.trim(), handle: f.handle.trim() || null,
      link: f.link.trim() || null, region: f.region.trim() || null, prefecture: f.prefecture.trim() || null,
      followers: f.followers ? parseInt(f.followers.replace(/[^\d]/g, ""), 10) : null, note: f.note.trim() || null,
      created_by: username || null,
    });
    setBusy(false); onSaved();
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between">
          <p className="font-bold text-gray-800 text-sm">アカウントを追加</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="p-4 space-y-2.5 text-sm">
          <Field label="カテゴリ"><input value={f.category} onChange={(e) => set("category", e.target.value)} placeholder="例：家具 / インテリア / リフォーム" className="in" /></Field>
          <Field label="名前 *"><input value={f.name} onChange={(e) => set("name", e.target.value)} className="in" /></Field>
          <Field label="Instagramハンドル"><input value={f.handle} onChange={(e) => set("handle", e.target.value)} placeholder="@なしで（例：sho_san）" className="in" /></Field>
          <Field label="リンク（任意）"><input value={f.link} onChange={(e) => set("link", e.target.value)} placeholder="https://…（未入力ならハンドルから自動）" className="in" /></Field>
          <div className="flex gap-2">
            <Field label="地方"><input value={f.region} onChange={(e) => set("region", e.target.value)} placeholder="関東 等" className="in" /></Field>
            <Field label="都道府県"><input value={f.prefecture} onChange={(e) => set("prefecture", e.target.value)} placeholder="東京都 等" className="in" /></Field>
          </div>
          <Field label="フォロワー数（任意）"><input value={f.followers} onChange={(e) => set("followers", e.target.value)} inputMode="numeric" className="in" /></Field>
          <Field label="メモ（任意）"><input value={f.note} onChange={(e) => set("note", e.target.value)} className="in" /></Field>
          <button onClick={save} disabled={busy} className="w-full bg-teal-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50 mt-1">追加する</button>
        </div>
      </div>
      <style>{`.in{width:100%;border:1px solid #e5e7eb;border-radius:.5rem;padding:.4rem .6rem;font-size:.8rem}`}</style>
    </div>
  );
}

// ---------------- 小物 ----------------
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block flex-1"><span className="block text-[11px] text-gray-500 mb-0.5">{label}</span>{children}</label>;
}
function Badge({ children, c }: { children: React.ReactNode; c: string }) {
  const m: Record<string, string> = { teal: "bg-teal-50 text-teal-700", slate: "bg-slate-100 text-slate-600", indigo: "bg-indigo-50 text-indigo-700" };
  return <span className={`text-[10px] rounded px-1.5 py-0.5 font-medium ${m[c]}`}>{children}</span>;
}
function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-semibold text-gray-600 mb-2">{label}</label><div className="flex flex-wrap gap-1.5">{children}</div></div>;
}
function Chip({ children, active, onClick, color }: { children: React.ReactNode; active: boolean; onClick: () => void; color?: string }) {
  const on = color === "teal" ? "bg-teal-600 text-white border-teal-600" : color === "slate" ? "bg-slate-600 text-white border-slate-600" : color === "violet" ? "bg-violet-600 text-white border-violet-600" : "bg-gray-800 text-white border-gray-800";
  return <button onClick={onClick} className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${active ? on : "bg-white text-gray-600 border-gray-200 active:bg-gray-50"}`}>{children}</button>;
}
function Select({ value, onChange, placeholder, disabled, children }: { value: string; onChange: (v: string) => void; placeholder: string; disabled?: boolean; children: React.ReactNode }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}
        className={`w-full appearance-none border rounded-lg pl-3 pr-8 py-2.5 sm:py-2 text-base sm:text-sm bg-white ${disabled ? "text-gray-300 bg-gray-50" : "text-gray-700"}`}>
        <option value="">{placeholder}</option>{children}
      </select>
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">▼</span>
    </div>
  );
}
const CHIP_COLORS: Record<string, { on: string; off: string }> = {
  emerald: { on: "bg-emerald-600 text-white border-emerald-600", off: "bg-white text-emerald-700 border-emerald-200 active:bg-emerald-50" },
  amber: { on: "bg-amber-500 text-white border-amber-500", off: "bg-white text-amber-700 border-amber-200 active:bg-amber-50" },
  pink: { on: "bg-pink-600 text-white border-pink-600", off: "bg-white text-pink-700 border-pink-200 active:bg-pink-50" },
};
function TagGroup({ label, hint, tags, selected, onToggle, color }: { label: string; hint?: string; tags: string[]; selected: string[]; onToggle: (t: string) => void; color: string }) {
  const c = CHIP_COLORS[color];
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-2">{label}{hint && <span className="ml-1 font-normal text-gray-400">{hint}</span>}</label>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => <button key={t} onClick={() => onToggle(t)} className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${selected.includes(t) ? c.on : c.off}`}>{t}</button>)}
      </div>
    </div>
  );
}

function ResultCard({ a, rank, matched, stat, onClick }: { a: Account; rank: number; matched: string[]; stat?: { count: number; rateScore: number }; onClick: () => void }) {
  const igUrl = igUrlOf(a);
  const rateLabel = stat && stat.rateScore >= 0 ? (stat.rateScore >= 2.5 ? "良" : stat.rateScore >= 1.5 ? "普通" : "悪") : null;
  return (
    <div className="w-full bg-white border rounded-xl p-3.5 sm:p-4 hover:border-gray-300 transition-colors">
      <div className="flex gap-3">
        <span className="text-xl sm:text-2xl font-bold text-gray-200 w-6 sm:w-7 text-center flex-shrink-0 leading-tight">{rank}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* 社名タップでInstagram（別タブ） */}
            {igUrl ? (
              <a href={igUrl} target="_blank" rel="noopener noreferrer"
                className="font-semibold text-sm text-pink-700 hover:text-pink-800 active:opacity-70 inline-flex items-center gap-0.5">
                {a.name}<span className="text-[10px] text-pink-400">↗</span>
              </a>
            ) : (
              <span className="font-semibold text-gray-800 text-sm">{a.name}</span>
            )}
            {a.source === SHOSAN && <Badge c="teal">SHO-SAN運用</Badge>}
            {a.source === BR && <Badge c="slate">他社候補</Badge>}
            {a.source === TEAM && <Badge c="teal">チーム追加</Badge>}
            {a.category && a.category !== "工務店" && <Badge c="indigo">{a.category}</Badge>}
            {a.region && <span className="text-[10px] bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">{a.region}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500 mt-0.5">
            {a.followers != null && <span>フォロワー {a.followers.toLocaleString()}人</span>}
            {a.prefecture && <span>{a.prefecture}</span>}
            {stat && stat.count > 0 && <span className="text-gray-400">💬 {stat.count}</span>}
            {rateLabel && <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${RATING_STYLE[rateLabel]}`}>バック率 {rateLabel}</span>}
          </div>
          {matched.length > 0 && <div className="flex flex-wrap gap-1 mt-2">{matched.map((t) => <span key={t} className="text-[10px] bg-emerald-50 text-emerald-700 rounded px-1.5 py-0.5 font-medium">{t}</span>)}</div>}
          <button onClick={onClick} className="text-[11px] text-blue-600 mt-2 hover:underline active:opacity-70">詳細・履歴・コメント →</button>
        </div>
      </div>
    </div>
  );
}
