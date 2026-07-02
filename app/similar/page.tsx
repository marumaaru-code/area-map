"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { Facility, OwnAccountProfile } from "@/types";

interface ScoredFacility extends Facility {
  similarity_reason?: string;
}

export default function SimilarPage() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
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

  useEffect(() => {
    async function load() {
      const { data: fData } = await supabase
        .from("facilities")
        .select("*")
        .eq("category", "construction");
      if (fData) setFacilities(fData as Facility[]);

      const { data: pData } = await supabase
        .from("own_account_profile")
        .select("*")
        .limit(1)
        .single();
      if (pData) {
        setProfile(pData as OwnAccountProfile);
        setProfileSaved(true);
      }
    }
    load().catch(() => {});
  }, []);

  async function saveProfile() {
    setSavingProfile(true);
    try {
      // Upsert single row (use fixed id=1)
      const { error } = await supabase.from("own_account_profile").upsert({
        id: 1,
        ...profile,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      setProfileSaved(true);
    } catch (e) {
      console.error(e);
      alert("保存に失敗しました。");
    } finally {
      setSavingProfile(false);
    }
  }

  async function analyze() {
    const withMemo = facilities.filter((f) => f.concept_memo);
    if (withMemo.length === 0) {
      setError("コンセプトメモが入力された工務店がありません。マップ画面でメモを追加してください。");
      return;
    }
    if (!profile.concept_memo) {
      setError("自社アカウントのコンセプトメモを入力してください。");
      return;
    }
    setAnalyzing(true);
    setError("");
    setRanked([]);
    try {
      const res = await fetch("/api/ai/similar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facilities: withMemo, profile }),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setRanked(json.ranked);
    } catch (e) {
      setError("AI分析に失敗しました。ANTHROPIC_API_KEYを確認してください。");
      console.error(e);
    } finally {
      setAnalyzing(false);
    }
  }

  const withMemoCount = facilities.filter((f) => f.concept_memo).length;
  const noMemoCount = facilities.filter((f) => !f.concept_memo).length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-800 mb-1">類似アカウント抽出</h1>
        <p className="text-sm text-gray-500">自社のコンセプトと近い工務店をAIがランキングします。</p>
      </div>

      {/* Own account profile */}
      <div className="bg-white border rounded-lg p-4">
        <h2 className="font-semibold text-gray-700 mb-3 text-sm">自社アカウントの特徴</h2>
        <div className="space-y-3 text-sm">
          <div>
            <label className="block text-xs text-gray-500 mb-1">コンセプト・テイスト</label>
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
          <button
            onClick={saveProfile}
            disabled={savingProfile}
            className="bg-gray-700 hover:bg-gray-800 disabled:opacity-50 text-white text-sm px-4 py-2 rounded"
          >
            {savingProfile ? "保存中..." : profileSaved ? "更新する" : "保存する"}
          </button>
        </div>
      </div>

      {/* Status */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
        <p>工務店データ：{facilities.length}件（メモあり：{withMemoCount}件 / メモなし：{noMemoCount}件）</p>
        {noMemoCount > 0 && (
          <p className="mt-1 text-xs text-blue-600">
            メモが未入力の{noMemoCount}件は対象外です。
            <a href="/map" className="underline ml-1">マップ画面でメモを追加してください →</a>
          </p>
        )}
      </div>

      <div>
        <button
          onClick={analyze}
          disabled={analyzing || withMemoCount === 0}
          className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium px-5 py-2.5 rounded text-sm"
        >
          {analyzing ? "AI分析中..." : "類似アカウントをAIで抽出する"}
        </button>
        {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
      </div>

      {ranked.length > 0 && (
        <div>
          <h2 className="font-semibold text-gray-700 mb-3 text-sm">類似アカウント一覧（類似度順）</h2>
          <div className="space-y-2">
            {ranked.map((f, i) => (
              <div key={f.id} className="bg-white border rounded-lg p-4 text-sm flex gap-4">
                <span className="text-2xl font-bold text-gray-200 self-center w-8 text-center">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800">{f.name_ja || f.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{f.address || `${f.lat.toFixed(4)}, ${f.lng.toFixed(4)}`}</p>
                  {f.concept_memo && (
                    <p className="text-xs text-gray-600 mt-1 bg-gray-50 rounded p-1.5">{f.concept_memo}</p>
                  )}
                  {f.similarity_reason && (
                    <p className="text-xs text-purple-700 mt-1.5">💡 {f.similarity_reason}</p>
                  )}
                </div>
                <div className="flex flex-col gap-1 self-start">
                  {f.instagram_url && (
                    <a
                      href={f.instagram_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-pink-600 hover:underline whitespace-nowrap"
                    >
                      Instagram →
                    </a>
                  )}
                  {f.website && (
                    <a
                      href={f.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline whitespace-nowrap"
                    >
                      Web →
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
