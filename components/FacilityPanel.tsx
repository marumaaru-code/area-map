"use client";

import { useState } from "react";
import type { Facility } from "@/types";
import { CATEGORY_LABELS } from "@/types";
import { upsertFacility } from "@/lib/db";
import { koumutenSupabase } from "@/lib/koumuten-supabase";

interface Props {
  facility: Facility;
  onClose: () => void;
  onUpdated: (updated: Facility) => void;
}

const PREFS = ["北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県", "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県", "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県", "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県", "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"];
function prefFromAddress(addr?: string): string | null {
  if (!addr) return null;
  return PREFS.find((p) => addr.includes(p)) || null;
}
function handleFromUrl(url: string): string | null {
  const m = url.match(/instagram\.com\/([A-Za-z0-9_.]+)/);
  return m ? m[1].replace(/\/$/, "") : null;
}

export default function FacilityPanel({ facility, onClose, onUpdated }: Props) {
  const [instagramUrl, setInstagramUrl] = useState(facility.instagram_url || "");
  const [website, setWebsite] = useState(facility.website || "");
  const [memo, setMemo] = useState(facility.concept_memo || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [followMsg, setFollowMsg] = useState("");
  const [followBusy, setFollowBusy] = useState(false);

  async function addToFollowTool() {
    setFollowBusy(true);
    setFollowMsg("");
    try {
      const link = instagramUrl || website || null;
      const note = [facility.address, memo].filter(Boolean).join(" / ") || null;
      const { error } = await koumutenSupabase.from("follow_accounts").insert({
        category: CATEGORY_LABELS[facility.category] || "その他",
        name: facility.name_ja || facility.name,
        handle: handleFromUrl(instagramUrl),
        link,
        region: null,
        prefecture: prefFromAddress(facility.address),
        followers: null,
        note,
        created_by: "マップから追加",
      });
      if (error) throw error;
      setFollowMsg("フォロー選定ツールに追加しました");
    } catch (e) {
      setFollowMsg("追加に失敗しました。");
      console.error(e);
    } finally {
      setFollowBusy(false);
    }
  }

  const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(
    (facility.name_ja || facility.name) + " Instagram"
  )}`;

  async function handleSave() {
    setSaving(true);
    setMessage("");
    try {
      // Upsert via /api/facilities. Sending the full row means this works whether
      // the facility already exists (manual) or not yet (OSM, first edit).
      await upsertFacility({
        id: facility.id,
        source: facility.source,
        category: facility.category,
        name: facility.name,
        name_ja: facility.name_ja ?? null,
        lat: facility.lat,
        lng: facility.lng,
        address: facility.address ?? null,
        website: website || null,
        instagram_url: instagramUrl || null,
        concept_memo: memo || null,
      });
      onUpdated({
        ...facility,
        website: website || undefined,
        instagram_url: instagramUrl || undefined,
        concept_memo: memo || undefined,
      });
      setMessage("保存しました");
    } catch (e) {
      setMessage("保存に失敗しました。Supabaseの接続設定を確認してください。");
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="font-bold text-gray-800 text-sm leading-snug max-w-[240px] truncate">
          {facility.name_ja || facility.name}
        </h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-xl leading-none"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
        <div>
          <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
            {CATEGORY_LABELS[facility.category]}
          </span>
        </div>

        {facility.address && (
          <div>
            <p className="text-xs text-gray-500 mb-1">住所</p>
            <p className="text-gray-700 text-xs leading-relaxed">{facility.address}</p>
          </div>
        )}

        <div>
          <p className="text-xs text-gray-500 mb-1">公式サイト</p>
          {facility.website ? (
            <a
              href={facility.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline text-xs break-all"
            >
              {facility.website}
            </a>
          ) : (
            <span className="text-gray-400 text-xs">未登録</span>
          )}
          <input
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://example.com"
            className="mt-1 w-full border rounded px-2 py-1 text-xs"
          />
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-1">Instagram</p>
          {facility.instagram_url ? (
            <a
              href={facility.instagram_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-pink-600 underline text-xs break-all"
            >
              {facility.instagram_url}
            </a>
          ) : (
            <a
              href={googleSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded"
            >
              Googleで検索する →
            </a>
          )}
          <input
            type="url"
            value={instagramUrl}
            onChange={(e) => setInstagramUrl(e.target.value)}
            placeholder="https://www.instagram.com/..."
            className="mt-1 w-full border rounded px-2 py-1 text-xs"
          />
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-1">メモ（テイスト・価格帯・施工エリアなど）</p>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={3}
            className="w-full border rounded px-2 py-1 text-xs resize-none"
            placeholder="例：ナチュラルテイスト、坪単価60〜80万円、北摂エリア中心"
          />
        </div>

        {message && (
          <p className={`text-xs ${message.includes("失敗") ? "text-red-500" : "text-green-600"}`}>
            {message}
          </p>
        )}
      </div>

      <div className="p-4 border-t space-y-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded"
        >
          {saving ? "保存中..." : "保存する"}
        </button>
        <button
          onClick={addToFollowTool}
          disabled={followBusy}
          className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded flex items-center justify-center gap-1"
        >
          {followBusy ? "追加中..." : "＋ フォロー選定ツールに追加"}
        </button>
        {followMsg && (
          <p className={`text-xs text-center ${followMsg.includes("失敗") ? "text-red-500" : "text-teal-600"}`}>{followMsg}</p>
        )}
      </div>
    </div>
  );
}
