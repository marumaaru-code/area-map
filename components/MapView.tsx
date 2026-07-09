"use client";

import { useEffect, useRef, useState } from "react";
import type { Facility, FacilityCategory } from "@/types";
import { CATEGORY_COLORS, CATEGORY_EMOJI, CATEGORY_LABELS } from "@/types";
import { fetchOverpassFacilities, reverseGeocode } from "@/lib/overpass";
import { supabase } from "@/lib/supabase";
import FacilityPanel from "./FacilityPanel";
import AddFacilityModal from "./AddFacilityModal";

import type { Map as LeafletMap, Marker } from "leaflet";


const DEBOUNCE_MS = 800;
const ACTIVE_CATEGORIES = Object.keys(CATEGORY_COLORS) as FacilityCategory[];

function makePinIcon(
  L: typeof import("leaflet"),
  color: string,
  emoji: string
) {
  return L.divIcon({
    html: `<div style="
      position:relative;
      width:36px;
      height:44px;
      display:flex;
      flex-direction:column;
      align-items:center;
    ">
      <div style="
        width:36px;
        height:36px;
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        background:${color};
        border:2px solid white;
        box-shadow:0 2px 6px rgba(0,0,0,0.3);
        display:flex;
        align-items:center;
        justify-content:center;
      ">
        <span style="transform:rotate(45deg);font-size:17px;line-height:1;">${emoji}</span>
      </div>
      <div style="
        width:4px;height:8px;
        background:${color};
        border-radius:0 0 2px 2px;
        margin-top:-1px;
      "></div>
    </div>`,
    className: "",
    iconSize: [36, 44],
    iconAnchor: [18, 44],
    popupAnchor: [0, -44],
  });
}

interface MapViewProps {
  initialLat?: number;
  initialLng?: number;
  initialZoom?: number;
}

export default function MapView({ initialLat, initialLng, initialZoom }: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // refs for values accessed inside map event callbacks (avoids stale closure)
  const activeCategoriesRef = useRef<Set<FacilityCategory>>(new Set(ACTIVE_CATEGORIES));
  const manualFacilitiesRef = useRef<Facility[]>([]);
  const allOsmRef = useRef<Map<string, Facility>>(new Map());
  const leafletRef = useRef<typeof import("leaflet") | null>(null);

  // React state (for re-rendering UI only)
  const [activeCategories, setActiveCategories] = useState<Set<FacilityCategory>>(
    new Set(ACTIVE_CATEGORIES)
  );
  const [manualFacilities, setManualFacilities] = useState<Facility[]>([]);
  const [selected, setSelected] = useState<Facility | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // keep refs in sync with state
  useEffect(() => { activeCategoriesRef.current = activeCategories; }, [activeCategories]);
  useEffect(() => { manualFacilitiesRef.current = manualFacilities; }, [manualFacilities]);

  // Load manual facilities from Supabase once
  useEffect(() => {
    supabase
      .from("facilities")
      .select("*")
      .eq("source", "manual")
      .then(({ data }) => {
        if (data) setManualFacilities(data as Facility[]);
      }, () => {});
  }, []);

  // ── marker helpers ────────────────────────────────────────────────────────

  function addMarker(facility: Facility) {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    if (!activeCategoriesRef.current.has(facility.category)) return;
    if (markersRef.current.has(facility.id)) return;

    const color = CATEGORY_COLORS[facility.category];
    const emoji = CATEGORY_EMOJI[facility.category];
    const icon = makePinIcon(L, color, emoji);
    const marker = L.marker([facility.lat, facility.lng], { icon });

    async function onActivate() {
      // 即パネルを開く（住所は後から差し込む）
      setSelected(facility);

      // Supabase の保存済みデータをマージ
      let f = facility;
      const { data } = await supabase
        .from("facilities")
        .select("*")
        .eq("id", facility.id)
        .single();
      if (data) f = { ...facility, ...data };

      // 住所が無ければ逆ジオコーディング（バックグラウンド）
      if (!f.address) {
        f = { ...f, address: "住所を取得中…" };
        setSelected({ ...f });
        const address = await reverseGeocode(f.lat, f.lng);
        f = { ...f, address };
      }
      setSelected({ ...f });
    }

    marker.on("click", onActivate);
    marker.on("touchend", (e) => {
      (e as unknown as { originalEvent?: TouchEvent }).originalEvent?.preventDefault();
      onActivate();
    });

    marker.addTo(map);
    markersRef.current.set(facility.id, marker);
  }

  function clearAllMarkers() {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();
  }

  function redrawMarkers() {
    clearAllMarkers();
    allOsmRef.current.forEach((f) => addMarker(f));
    manualFacilitiesRef.current.forEach((f) => addMarker(f));
  }

  // ── fetch from Overpass for current viewport ──────────────────────────────

  async function fetchAndRender() {
    const map = mapRef.current;
    if (!map) return;
    const bounds = map.getBounds();
    const south = bounds.getSouth();
    const west = bounds.getWest();
    const north = bounds.getNorth();
    const east = bounds.getEast();

    if (north - south > 1 || east - west > 1) return; // too wide

    setLoading(true);
    try {
      const facilities = await fetchOverpassFacilities([south, west, north, east]);
      facilities.forEach((f) => {
        allOsmRef.current.set(f.id, f);
        addMarker(f);
      });
      manualFacilitiesRef.current.forEach((f) => addMarker(f));
    } catch (e) {
      console.error("Overpass fetch failed", e);
    } finally {
      setLoading(false);
    }
  }

  // ── initialize map once ───────────────────────────────────────────────────

  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;

    import("leaflet").then((L) => {
      leafletRef.current = L;

      delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const centerLat = initialLat ?? 34.6937;
      const centerLng = initialLng ?? 135.5023;
      const zoom = initialZoom ?? 13;
      const map = L.map(mapContainerRef.current!).setView([centerLat, centerLng], zoom);
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        {
          attribution:
            '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/">CARTO</a>',
          subdomains: "abcd",
          maxZoom: 20,
        }
      ).addTo(map);

      mapRef.current = map;

      map.on("moveend", () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(fetchAndRender, DEBOUNCE_MS);
      });

      fetchAndRender();
    });

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── redraw when categories or manual facilities change ────────────────────
  // Use a ref-flag to skip the very first render (map not ready yet)
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    if (!mapRef.current) return;
    redrawMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategories, manualFacilities]);

  // ── UI handlers ───────────────────────────────────────────────────────────

  function toggleCategory(cat: FacilityCategory) {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }

  function handleFacilityUpdated(updated: Facility) {
    setSelected(updated);
    allOsmRef.current.set(updated.id, updated);
  }

  function handleFacilityAdded(facility: Facility) {
    setManualFacilities((prev) => [...prev, facility]);
    setShowAddModal(false);
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Category filter */}
      <div className="absolute top-3 left-3 z-[1000] bg-white rounded-lg shadow p-2 space-y-1">
        {ACTIVE_CATEGORIES.map((cat) => (
          <label
            key={cat}
            className="flex items-center gap-2 cursor-pointer select-none"
          >
            <input
              type="checkbox"
              checked={activeCategories.has(cat)}
              onChange={() => toggleCategory(cat)}
              className="hidden"
            />
            <span className="text-base flex-shrink-0 leading-none">
              {CATEGORY_EMOJI[cat]}
            </span>
            <span
              className={`text-xs ${
                activeCategories.has(cat) ? "text-gray-800" : "text-gray-400"
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </span>
          </label>
        ))}
      </div>

      {/* Add facility button */}
      <button
        onClick={() => setShowAddModal(true)}
        className="absolute bottom-8 left-3 z-[1000] bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-2 rounded-lg shadow"
      >
        ＋ 施設を手動追加
      </button>

      {/* Loading */}
      {loading && (
        <div className="absolute top-3 right-3 z-[1000] bg-white rounded-full shadow px-3 py-1 text-xs text-gray-500">
          読み込み中…
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <>
          <div
            className="fixed inset-0 z-[2000] bg-black/20 md:hidden"
            onClick={() => setSelected(null)}
          />
          <div className="
            fixed z-[2001]
            bottom-0 left-0 right-0 h-[70vh]
            md:absolute md:top-0 md:right-0 md:bottom-0 md:left-auto md:h-full md:w-80
            bg-white shadow-2xl overflow-hidden rounded-t-2xl md:rounded-none
          ">
            <FacilityPanel
              facility={selected}
              onClose={() => setSelected(null)}
              onUpdated={handleFacilityUpdated}
            />
          </div>
        </>
      )}

      {showAddModal && (
        <AddFacilityModal
          defaultLat={mapRef.current?.getCenter().lat}
          defaultLng={mapRef.current?.getCenter().lng}
          onClose={() => setShowAddModal(false)}
          onAdded={handleFacilityAdded}
        />
      )}
    </div>
  );
}
