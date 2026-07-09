"use client";

import { useState, useEffect } from "react";
import { listPosts, insertPost } from "@/lib/db";
import type { Post } from "@/types";

interface Proposal {
  title: string;
  aim: string;
  format: string;
  outline: string;
}

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [form, setForm] = useState({
    theme: "",
    caption: "",
    format: "feed" as Post["format"],
    likes: "",
    saves: "",
    comments: "",
    memo: "",
  });
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [aiError, setAiError] = useState("");

  useEffect(() => {
    listPosts()
      .then((data) => setPosts(data))
      .catch(() => {});
  }, []);

  function setField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleAddPost(e: React.FormEvent) {
    e.preventDefault();
    if (!form.theme) return;
    setSaving(true);
    try {
      const post = {
        posted_at: new Date().toISOString(),
        theme: form.theme,
        caption: form.caption,
        format: form.format,
        likes: parseInt(form.likes) || 0,
        saves: parseInt(form.saves) || 0,
        comments: parseInt(form.comments) || 0,
        memo: form.memo || null,
      };
      const created = await insertPost(post);
      setPosts((prev) => [created, ...prev]);
      setForm({ theme: "", caption: "", format: "feed", likes: "", saves: "", comments: "", memo: "" });
    } catch (e) {
      console.error(e);
      alert("保存に失敗しました。Supabaseの接続設定を確認してください。");
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerate() {
    if (posts.length === 0) {
      setAiError("投稿ログを1件以上追加してから実行してください。");
      return;
    }
    setGenerating(true);
    setAiError("");
    setProposals([]);
    try {
      const res = await fetch("/api/ai/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ posts }),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setProposals(json.proposals);
    } catch (e) {
      setAiError("AI提案の生成に失敗しました。ANTHROPIC_API_KEYを確認してください。");
      console.error(e);
    } finally {
      setGenerating(false);
    }
  }

  const formatLabels: Record<Post["format"], string> = {
    reel: "リール",
    feed: "フィード",
    story: "ストーリーズ",
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-800 mb-1">投稿企画・改善提案</h1>
        <p className="text-sm text-gray-500">過去の投稿ログをもとにAIが次の企画案を提案します。</p>
      </div>

      {/* Add post form */}
      <div className="bg-white rounded-lg border p-4">
        <h2 className="font-semibold text-gray-700 mb-3 text-sm">投稿ログを追加</h2>
        <form onSubmit={handleAddPost} className="space-y-3 text-sm">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">テーマ *</label>
              <input
                value={form.theme}
                onChange={(e) => setField("theme", e.target.value)}
                className="w-full border rounded px-2 py-1.5"
                placeholder="例：外観おしゃれ施工事例"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">フォーマット</label>
              <select
                value={form.format}
                onChange={(e) => setField("format", e.target.value)}
                className="border rounded px-2 py-1.5"
              >
                <option value="feed">フィード</option>
                <option value="reel">リール</option>
                <option value="story">ストーリーズ</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">キャプション</label>
            <textarea
              value={form.caption}
              onChange={(e) => setField("caption", e.target.value)}
              rows={2}
              className="w-full border rounded px-2 py-1.5 resize-none"
              placeholder="投稿のキャプションを入力"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">いいね数</label>
              <input type="number" value={form.likes} onChange={(e) => setField("likes", e.target.value)} className="w-full border rounded px-2 py-1.5" min="0" />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">保存数</label>
              <input type="number" value={form.saves} onChange={(e) => setField("saves", e.target.value)} className="w-full border rounded px-2 py-1.5" min="0" />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">コメント数</label>
              <input type="number" value={form.comments} onChange={(e) => setField("comments", e.target.value)} className="w-full border rounded px-2 py-1.5" min="0" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">メモ</label>
            <input value={form.memo} onChange={(e) => setField("memo", e.target.value)} className="w-full border rounded px-2 py-1.5" placeholder="気づきなど" />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded font-medium"
          >
            {saving ? "追加中..." : "追加する"}
          </button>
        </form>
      </div>

      {/* Post log */}
      {posts.length > 0 && (
        <div>
          <h2 className="font-semibold text-gray-700 mb-2 text-sm">投稿ログ（直近{posts.length}件）</h2>
          <div className="space-y-2">
            {posts.map((p) => (
              <div key={p.id} className="bg-white border rounded p-3 text-xs flex gap-4">
                <span className="bg-gray-100 text-gray-600 rounded px-1.5 py-0.5 self-start whitespace-nowrap">
                  {formatLabels[p.format]}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 truncate">{p.theme}</p>
                  {p.caption && <p className="text-gray-500 truncate mt-0.5">{p.caption}</p>}
                </div>
                <div className="flex gap-3 text-gray-500 whitespace-nowrap self-center">
                  <span>♥ {p.likes}</span>
                  <span>🔖 {p.saves}</span>
                  <span>💬 {p.comments}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI generate */}
      <div>
        <button
          onClick={handleGenerate}
          disabled={generating || posts.length === 0}
          className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium px-5 py-2.5 rounded text-sm"
        >
          {generating ? "AI分析中..." : "AIで投稿企画を提案してもらう"}
        </button>
        {aiError && <p className="text-red-500 text-xs mt-2">{aiError}</p>}
      </div>

      {/* Proposals */}
      {proposals.length > 0 && (
        <div>
          <h2 className="font-semibold text-gray-700 mb-3 text-sm">AI提案（{proposals.length}件）</h2>
          <div className="space-y-3">
            {proposals.map((p, i) => (
              <div key={i} className="bg-white border rounded-lg p-4 text-sm">
                <div className="flex items-start gap-2 mb-2">
                  <span className="bg-purple-100 text-purple-700 text-xs rounded px-1.5 py-0.5 font-medium whitespace-nowrap">案{i + 1}</span>
                  <h3 className="font-semibold text-gray-800">{p.title}</h3>
                </div>
                <p className="text-xs text-gray-500 mb-1">フォーマット：{p.format}</p>
                <p className="text-gray-700 mb-2 text-xs leading-relaxed">狙い：{p.aim}</p>
                <p className="text-gray-600 text-xs leading-relaxed bg-gray-50 rounded p-2">{p.outline}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
