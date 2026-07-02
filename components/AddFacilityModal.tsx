"use client";

import { useState } from "react";
import type { Facility, FacilityCategory } from "@/types";
import { CATEGORY_LABELS } from "@/types";
import { supabase } from "@/lib/supabase";

interface Props {
  defaultLat?: number;
  defaultLng?: number;
  onClose: () => void;
  onAdded: (facility: Facility) => void;
}

export default function AddFacilityModal({ defaultLat, defaultLng, onClose, onAdded }: Props) {
  const [form, setForm] = useState({
    name: "",
    category: "construction" as FacilityCategory,
    lat: defaultLat?.toString() || "",
    lng: defaultLng?.toString() || "",
    website: "",
    instagram_url: "",
    concept_memo: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.lat || !form.lng) {
      setError("施設名・緯度・経度は必須です");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const id = `manual-${Date.now()}`;
      const facility: Facility = {
        id,
        source: "manual",
        category: form.category,
        name: form.name,
        lat: parseFloat(form.lat),
        lng: parseFloat(form.lng),
        website: form.website || undefined,
        instagram_url: form.instagram_url || undefined,
        concept_memo: form.concept_memo || undefined,
      };
      const { error: dbError } = await supabase.from("facilities").insert({
        ...facility,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (dbError) throw dbError;
      onAdded(facility);
    } catch (e) {
      setError("保存に失敗しました。Supabaseの接続設定を確認してください。");
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999]">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-bold text-gray-800">施設を手動追加</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3 text-sm">
          <div>
            <label className="block text-xs text-gray-500 mb-1">カテゴリ *</label>
            <select
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              className="w-full border rounded px-2 py-1.5"
            >
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">施設名 *</label>
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className="w-full border rounded px-2 py-1.5"
              placeholder="例：〇〇建設"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">緯度 *</label>
              <input
                value={form.lat}
                onChange={(e) => set("lat", e.target.value)}
                className="w-full border rounded px-2 py-1.5"
                placeholder="34.6937"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">経度 *</label>
              <input
                value={form.lng}
                onChange={(e) => set("lng", e.target.value)}
                className="w-full border rounded px-2 py-1.5"
                placeholder="135.5023"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">公式サイト</label>
            <input
              value={form.website}
              onChange={(e) => set("website", e.target.value)}
              className="w-full border rounded px-2 py-1.5"
              placeholder="https://example.com"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Instagram URL</label>
            <input
              value={form.instagram_url}
              onChange={(e) => set("instagram_url", e.target.value)}
              className="w-full border rounded px-2 py-1.5"
              placeholder="https://www.instagram.com/..."
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">メモ</label>
            <textarea
              value={form.concept_memo}
              onChange={(e) => set("concept_memo", e.target.value)}
              rows={2}
              className="w-full border rounded px-2 py-1.5 resize-none"
              placeholder="テイスト・価格帯・施工エリアなど"
            />
          </div>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border rounded py-2 text-gray-600 hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded py-2 font-medium"
            >
              {saving ? "追加中..." : "追加する"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
