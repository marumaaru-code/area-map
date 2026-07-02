"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { Facility, OwnAccountProfile } from "@/types";

interface ScoredFacility extends Facility {
  similarity_reason?: string;
}

// 手動で追加できるシンプルな工務店エントリ
interface ManualEntry {
  id: string;
  name: string;
  concept_memo: string;
  instagram_url: string;
}

export default function SimilarPage() {
  const [dbFacilities, setDbFacilities] = useState<Facility[]>([]);
  const [manualEntries, setManualEntries] = useState<ManualEntry[]>([]);
  const [newEntry, setNewEntry] = useState<ManualEntry>({ id: "", name: "", concept_memo: "", instagram_url: "" });
  const [profile, setProfile] = useState<OwnAccountProfile>({
    concept_memo: "",
    target_area: "",
    brand_tone: "",
  });
  const [profileSaved, setProfileSaved] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [ranked, setRanked] = useState<ScoredFacility[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const { data: fData, error: fErr } = await supabase
          .from("facilities")
          .select("*")
          .eq("category", "construction");
        if (fErr) throw fErr;
        if (fData) {
          setDbFacilities(fData as Facility[]);
          setDbConnected(true);
        }
        const { data: pData } = await supabase
          .from("own_account_profile")
          .select("*")
          .limit(1)
          .single();
        if (pData) {
          setProfile(pData as OwnAccountProfile);
          setProfileSaved(true);
        }
      } catch {
        setDbConnected(false);
      }
    }
    load();
  }, []);

  // 分析対象 = DBのfacilities（メモあり）+ 手動入力
  const allTargets: Facility[] = [
    ...dbFacilities.filter((f) => f.concept_memo),
    ...manualEntries.map((e) => ({
      id: e.id,
      source: "manual" as const,
      category: "construction" as const,
      name: e.name,
      lat: 0,
      lng: 0,
      concept_memo: e.concept_memo,
      instagram_url: e.instagram_url || undefined,
    })),
  ];

  async function saveProfile() {
    setSavingProfile(true);
    try {
      const { error: e } = await supabase.from("own_account_profile").upsert({
        id: 1,
        ...profile,
        updated_at: new Date().toISOString(),
      });
      if (e) throw e;
      setProfileSaved(true);
    } catch (err) {
      console.error(err);
      // プロフィールはローカルに保持するだけでもAI分析は動く
    } finally {
      setSavingProfile(false);
    }
  }

  function addManualEntry() {
    if (!newEntry.name || !newEntry.concept_memo) return;
    setManualEntries((prev) => [
      ...prev,
      { ...newEntry, id: `manual-tmp-${Date.now()}` },
    ]);
    setNewEntry({ id: "", name: "", concept_memo: "", instagram_url: "" });
  }

  function removeManualEntry(id: string) {
    setManualEntries((prev) => prev.filter((e) => e.id !== id));
  }

  async function analyze() {
    if (!profile.concept_memo) {
      setError("自社アカウントのコンセプトを入力してください。");
      return;
    }
    if (allTargets.length === 0) {
      setError("分析対象の工務店がありません。下の「工務店を手動で追加」から追加するか、マップ画面でメモを入力してください。");
      return;
    }
    setAnalyzing(true);
    setError("");
    setRanked([]);
    try {
      const res = await fetch("/api/ai/similar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facilities: allTargets, profile }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }
      const json = await res.json();
      setRanked(json.ranked);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("401") || msg.includes("api_key")) {
        setError("ANTHROPIC_API_KEY が無効です。.env.local を確認してください。");
      } else {
        setError(`AI分析に失敗しました：${msg}`);
      }
      console.error(e);
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800 mb-1">類似アカウント抽出</h1>
        <p className="text-sm text-gray-500">自社のコンセプトと近い工務店をAIがランキングします。</p>
      </div>

      {/* DB接続状態 */}
      {dbConnected === false && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 text-xs text-amber-800">
          Supabase未接続のため、DBから施設は読み込めていません。下の「手動追加」から直接工務店を追加して分析できます。
        </div>
      )}

      {/* 自社プロフィール */}
      <div className="bg-white border rounded-lg p-4">
        <h2 className="font-semibold text-gray-700 mb-3 text-sm">① 自社アカウントの特徴を入力</h2>
        <div className="space-y-3 text-sm">
          <div>
            <label className="block text-xs text-gray-500 mb-1">コンセプト・テイスト *</label>
            <textarea
              value={profile.concept_memo}
              onChange={(e) => setProfile((p) => ({ ...p, concept_memo: e.target.value }))}
              rows={2}
              className="w-full border rounded px-2 py-1.5 resize-none"
              placeholder="例：ナチュラルモダン、木の温かみを大切にしたデザイン住宅"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">ターゲットエリア</label>
              <input
                value={profile.target_area}
                onChange={(e) => setProfile((p) => ({ ...p, target_area: e.target.value }))}
                className="w-full border rounded px-2 py-1.5"
                placeholder="例：北摂・阪神間"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">ブランドトーン</label>
              <input
                value={profile.brand_tone}
                onChange={(e) => setProfile((p) => ({ ...p, brand_tone: e.target.value }))}
                className="w-full border rounded px-2 py-1.5"
                placeholder="例：親しみやすい・温かみのある"
              />
            </div>
          </div>
          {dbConnected && (
            <button
              onClick={saveProfile}
              disabled={savingProfile}
              className="bg-gray-700 hover:bg-gray-800 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded"
            >
              {savingProfile ? "保存中…" : profileSaved ? "✓ 更新する" : "DBに保存する"}
            </button>
          )}
        </div>
      </div>

      {/* 工務店手動追加 */}
      <div className="bg-white border rounded-lg p-4">
        <h2 className="font-semibold text-gray-700 mb-3 text-sm">② 比較する工務店を追加</h2>

        {/* DBから読んだもの */}
        {dbFacilities.filter((f) => f.concept_memo).length > 0 && (
          <p className="text-xs text-green-700 mb-3">
            DBから {dbFacilities.filter((f) => f.concept_memo).length} 件読み込み済み
          </p>
        )}

        {/* 手動追加フォーム */}
        <div className="space-y-2 text-sm mb-3">
          <div className="flex gap-2">
            <input
              value={newEntry.name}
              onChange={(e) => setNewEntry((p) => ({ ...p, name: e.target.value }))}
              className="flex-1 border rounded px-2 py-1.5 text-sm"
              placeholder="工務店名 *"
            />
            <input
              value={newEntry.instagram_url}
              onChange={(e) => setNewEntry((p) => ({ ...p, instagram_url: e.target.value }))}
              className="flex-1 border rounded px-2 py-1.5 text-sm"
              placeholder="Instagram URL（任意）"
            />
          </div>
          <div className="flex gap-2">
            <textarea
              value={newEntry.concept_memo}
              onChange={(e) => setNewEntry((p) => ({ ...p, concept_memo: e.target.value }))}
              rows={2}
              className="flex-1 border rounded px-2 py-1.5 text-sm resize-none"
              placeholder="コンセプト・テイスト・価格帯など *（例：高級注文住宅、シンプルモダン、坪単価80万〜）"
            />
            <button
              onClick={addManualEntry}
              disabled={!newEntry.name || !newEntry.concept_memo}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm px-3 rounded self-stretch"
            >
              追加
            </button>
          </div>
        </div>

        {/* 追加済みリスト */}
        {manualEntries.length > 0 && (
          <ul className="space-y-1">
            {manualEntries.map((e) => (
              <li key={e.id} className="flex items-center gap-2 text-xs bg-gray-50 rounded px-2 py-1.5">
                <span className="font-medium flex-shrink-0">{e.name}</span>
                <span className="text-gray-500 flex-1 truncate">{e.concept_memo}</span>
                <button onClick={() => removeManualEntry(e.id)} className="text-red-400 hover:text-red-600">✕</button>
              </li>
            ))}
          </ul>
        )}

        {allTargets.length === 0 && (
          <p className="text-xs text-gray-400 mt-2">まだ工務店が追加されていません。上のフォームから追加してください。</p>
        )}
      </div>

      {/* 分析実行 */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={analyze}
            disabled={analyzing || allTargets.length === 0 || !profile.concept_memo}
            className="bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white font-medium px-5 py-2.5 rounded text-sm"
          >
            {analyzing ? "AI分析中…" : `AIで類似度ランキング（${allTargets.length}件）`}
          </button>
          {allTargets.length > 0 && (
            <span className="text-xs text-gray-500">対象：{allTargets.length}件</span>
          )}
        </div>
        {error && (
          <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-xs text-red-700 whitespace-pre-wrap">
            {error}
          </div>
        )}
      </div>

      {/* 結果 */}
      {ranked.length > 0 && (
        <div>
          <h2 className="font-semibold text-gray-700 mb-3 text-sm">類似アカウント一覧（類似度順）</h2>
          <div className="space-y-2">
            {ranked.map((f, i) => (
              <div key={f.id} className="bg-white border rounded-lg p-4 text-sm flex gap-3">
                <span className="text-2xl font-bold text-gray-200 self-center w-7 text-center flex-shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800">{f.name_ja || f.name}</p>
                  {f.concept_memo && (
                    <p className="text-xs text-gray-600 mt-1 bg-gray-50 rounded p-1.5 leading-relaxed">{f.concept_memo}</p>
                  )}
                  {f.similarity_reason && (
                    <p className="text-xs text-purple-700 mt-1.5">💡 {f.similarity_reason}</p>
                  )}
                </div>
                {f.instagram_url && (
                  <a
                    href={f.instagram_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-pink-600 hover:underline self-start whitespace-nowrap"
                  >
                    Instagram →
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
