"use client";

import { useState } from "react";
import { fetchOverpassFacilities, AREA_SCORE_WEIGHTS } from "@/lib/overpass";
import type { AreaScore, FacilityCategory } from "@/types";

const RELATED_CATEGORIES: FacilityCategory[] = ["wedding", "roadside_station", "kindergarten", "furniture"];

// Grid: search a city-level bounding box subdivided into cells
const GRID_SIZE = 3; // 3x3 grid

interface SearchBbox {
  south: number;
  west: number;
  north: number;
  east: number;
  label: string;
}

const PRESET_AREAS: SearchBbox[] = [
  { label: "大阪市周辺", south: 34.55, west: 135.4, north: 34.75, east: 135.65 },
  { label: "神戸市周辺", south: 34.6, west: 135.05, north: 34.75, east: 135.3 },
  { label: "京都市周辺", south: 34.9, west: 135.6, north: 35.1, east: 135.85 },
  { label: "名古屋市周辺", south: 35.05, west: 136.8, north: 35.25, east: 137.05 },
  { label: "福岡市周辺", south: 33.5, west: 130.2, north: 33.7, east: 130.55 },
];

export default function AreasPage() {
  const [scores, setScores] = useState<AreaScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedArea, setSelectedArea] = useState<SearchBbox>(PRESET_AREAS[0]);
  const [error, setError] = useState("");

  async function analyze() {
    setLoading(true);
    setError("");
    setScores([]);
    try {
      const { south, west, north, east, label } = selectedArea;
      const latStep = (north - south) / GRID_SIZE;
      const lngStep = (east - west) / GRID_SIZE;

      const cells: AreaScore[] = [];
      for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
          const cellSouth = south + row * latStep;
          const cellNorth = cellSouth + latStep;
          const cellWest = west + col * lngStep;
          const cellEast = cellWest + lngStep;
          const centerLat = (cellSouth + cellNorth) / 2;
          const centerLng = (cellWest + cellEast) / 2;

          const facilities = await fetchOverpassFacilities([cellSouth, cellWest, cellNorth, cellEast]);
          const constructionCount = facilities.filter((f) => f.category === "construction").length;
          const relatedCount = facilities.filter((f) => RELATED_CATEGORIES.includes(f.category)).length;

          const score =
            relatedCount * AREA_SCORE_WEIGHTS.relatedFacilityWeight -
            constructionCount * AREA_SCORE_WEIGHTS.constructionPenaltyWeight;

          cells.push({
            area_name: `${label} エリア${row * GRID_SIZE + col + 1}`,
            construction_count: constructionCount,
            related_facility_count: relatedCount,
            score,
            calculated_at: new Date().toISOString(),
            lat: centerLat,
            lng: centerLng,
          });

          // Small delay to avoid overloading Overpass
          await new Promise((r) => setTimeout(r, 300));
        }
      }
      setScores(cells.sort((a, b) => b.score - a.score));
    } catch (e) {
      setError("取得に失敗しました。しばらく待ってから再試行してください。");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function jumpToMap(score: AreaScore) {
    if (score.lat && score.lng) {
      window.open(`/map?lat=${score.lat}&lng=${score.lng}&zoom=14`, "_self");
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-gray-800 mb-4">狙い目エリア一覧</h1>
      <p className="text-sm text-gray-500 mb-6">
        指定エリアをグリッド分割し、工務店の少なさ・関連施設の多さでスコアリングします。
        スコア = 関連施設数×{AREA_SCORE_WEIGHTS.relatedFacilityWeight} − 工務店数×{AREA_SCORE_WEIGHTS.constructionPenaltyWeight}
      </p>

      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={selectedArea.label}
          onChange={(e) => {
            const area = PRESET_AREAS.find((a) => a.label === e.target.value);
            if (area) setSelectedArea(area);
          }}
          className="border rounded px-3 py-2 text-sm"
        >
          {PRESET_AREAS.map((a) => (
            <option key={a.label} value={a.label}>{a.label}</option>
          ))}
        </select>
        <button
          onClick={analyze}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded"
        >
          {loading ? "分析中..." : "分析する"}
        </button>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {scores.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="px-3 py-2 font-medium text-gray-600">順位</th>
                <th className="px-3 py-2 font-medium text-gray-600">エリア</th>
                <th className="px-3 py-2 font-medium text-gray-600 text-right">工務店数</th>
                <th className="px-3 py-2 font-medium text-gray-600 text-right">関連施設数</th>
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
                      className="text-xs text-blue-600 hover:underline"
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
