"use client";

import { useState, useRef } from "react";
import { fetchOverpassFacilities, AREA_SCORE_WEIGHTS } from "@/lib/overpass";
import type { AreaScore, FacilityCategory } from "@/types";

const RELATED_CATEGORIES: FacilityCategory[] = ["wedding", "roadside_station", "kindergarten", "furniture"];
const GRID_SIZE = 3;

interface NominatimResult {
  display_name: string;
  boundingbox: [string, string, string, string]; // [south, north, west, east]
}

export default function AreasPage() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [selectedArea, setSelectedArea] = useState<{ label: string; bbox: [number, number, number, number] } | null>(null);
  const [scores, setScores] = useState<AreaScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function searchNominatim(q: string) {
    if (!q.trim()) { setSuggestions([]); return; }
    setSearching(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q + " 日本")}&format=json&limit=6&accept-language=ja&addressdetails=0`;
      const res = await fetch(url, { headers: { "User-Agent": "instagram-area-tool/1.0" } });
      const data: NominatimResult[] = await res.json();
      setSuggestions(data.filter((d) => d.boundingbox));
    } catch {
      setSuggestions([]);
    } finally {
      setSearching(false);
    }
  }

  function handleQueryChange(v: string) {
    setQuery(v);
    setSelectedArea(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchNominatim(v), 400);
  }

  function selectSuggestion(s: NominatimResult) {
    // Nominatim boundingbox order: [south, north, west, east]
    const [south, north, west, east] = s.boundingbox.map(Number);
    const label = s.display_name.split(",")[0];
    setSelectedArea({ label, bbox: [south, west, north, east] });
    setQuery(label);
    setSuggestions([]);
    setScores([]);
  }

  async function analyze() {
    if (!selectedArea) { setError("先に市区町村を選択してください"); return; }
    setLoading(true);
    setError("");
    setScores([]);
    setProgress(0);

    const total = GRID_SIZE * GRID_SIZE;
    try {
      const [south, west, north, east] = selectedArea.bbox;
      const latStep = (north - south) / GRID_SIZE;
      const lngStep = (east - west) / GRID_SIZE;

      const cells: AreaScore[] = [];
      for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
          const cs = south + row * latStep;
          const cn = cs + latStep;
          const cw = west + col * lngStep;
          const ce = cw + lngStep;

          const facilities = await fetchOverpassFacilities([cs, cw, cn, ce]);
          const constructionCount = facilities.filter((f) => f.category === "construction").length;
          const relatedCount = facilities.filter((f) => RELATED_CATEGORIES.includes(f.category)).length;
          const score =
            relatedCount * AREA_SCORE_WEIGHTS.relatedFacilityWeight -
            constructionCount * AREA_SCORE_WEIGHTS.constructionPenaltyWeight;

          cells.push({
            area_name: `${selectedArea.label} エリア${row * GRID_SIZE + col + 1}`,
            construction_count: constructionCount,
            related_facility_count: relatedCount,
            score,
            calculated_at: new Date().toISOString(),
            lat: (cs + cn) / 2,
            lng: (cw + ce) / 2,
          });
          setProgress(cells.length);
          await new Promise((r) => setTimeout(r, 300));
        }
      }
      setScores(cells.sort((a, b) => b.score - a.score));
    } catch (e) {
      setError("取得に失敗しました。しばらく待ってから再試行してください。");
      console.error(e);
    } finally {
      setLoading(false);
      setProgress(0);
    }

    void total;
  }

  // マップページに lat/lng をクエリパラメータで渡してジャンプ
  function jumpToMap(score: AreaScore) {
    if (score.lat == null || score.lng == null) return;
    const params = new URLSearchParams({
      lat: String(score.lat),
      lng: String(score.lng),
      zoom: "14",
    });
    window.location.href = `/map?${params.toString()}`;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-gray-800 mb-1">狙い目エリア一覧</h1>
      <p className="text-sm text-gray-500 mb-6">
        市区町村名で検索 → グリッド分割してスコアリングします。<br />
        スコア = 関連施設数×{AREA_SCORE_WEIGHTS.relatedFacilityWeight} − 工務店数×{AREA_SCORE_WEIGHTS.constructionPenaltyWeight}
      </p>

      <div className="relative mb-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="例：豊中市、宝塚市、浜松市…"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            {searching && (
              <span className="absolute right-2 top-2.5 text-xs text-gray-400">検索中…</span>
            )}
          </div>
          <button
            onClick={analyze}
            disabled={loading || !selectedArea}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg whitespace-nowrap"
          >
            {loading ? `分析中… (${progress}/${GRID_SIZE * GRID_SIZE})` : "分析する"}
          </button>
        </div>

        {suggestions.length > 0 && (
          <ul className="absolute top-full left-0 right-0 z-50 bg-white border rounded-lg shadow-lg mt-1 divide-y max-h-56 overflow-y-auto">
            {suggestions.map((s, i) => (
              <li key={i}>
                <button
                  onClick={() => selectSuggestion(s)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 truncate"
                >
                  {s.display_name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedArea && (
        <p className="text-xs text-blue-700 bg-blue-50 rounded px-3 py-1.5 mb-4">
          選択中：<strong>{selectedArea.label}</strong>　を {GRID_SIZE}×{GRID_SIZE} グリッドで分析します
        </p>
      )}

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {loading && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>データ取得中…</span>
            <span>{progress} / {GRID_SIZE * GRID_SIZE} セル</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all"
              style={{ width: `${(progress / (GRID_SIZE * GRID_SIZE)) * 100}%` }}
            />
          </div>
        </div>
      )}

      {scores.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="px-3 py-2 font-medium text-gray-600">順位</th>
                <th className="px-3 py-2 font-medium text-gray-600">エリア</th>
                <th className="px-3 py-2 font-medium text-gray-600 text-right">🏗️ 工務店</th>
                <th className="px-3 py-2 font-medium text-gray-600 text-right">関連施設</th>
                <th className="px-3 py-2 font-medium text-gray-600 text-right">スコア</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {scores.map((s, i) => (
                <tr key={s.area_name} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                  <td className="px-3 py-2 font-medium">{s.area_name}</td>
                  <td className="px-3 py-2 text-right text-red-600">{s.construction_count}</td>
                  <td className="px-3 py-2 text-right text-blue-600">{s.related_facility_count}</td>
                  <td className={`px-3 py-2 text-right font-bold ${s.score >= 0 ? "text-green-600" : "text-gray-400"}`}>
                    {s.score}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => jumpToMap(s)}
                      className="text-xs text-blue-600 hover:underline whitespace-nowrap"
                    >
                      地図で見る →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
