"use client";

import { useEffect, useRef, useState } from "react";
import type { Facility, FacilityCategory } from "@/types";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "@/types";
import { fetchOverpassFacilities, reverseGeocode } from "@/lib/overpass";
import { supabase } from "@/lib/supabase";
import FacilityPanel from "./FacilityPanel";
import AddFacilityModal from "./AddFacilityModal";

import type { Map as LeafletMap, Marker } from "leaflet";

// カテゴリごとに地図上で表示するアルファベット
const CATEGORY_LETTERS: Record<FacilityCategory, string> = {
  construction: "C",
  wedding: "W",
  roadside_station: "R",
  kindergarten: "K",
  furniture: "F",
};

const DEBOUNCE_MS = 800;
const ACTIVE_CATEGORIES = Object.keys(CATEGORY_COLORS) as FacilityCategory[];

function makePinIcon(
  L: typeof import("leaflet"),
  color: string,
  letter: string
) {
  return L.divIcon({
    html: `<svg viewBox="0 0 32 44" xmlns="http://www.w3.org/2000/svg" width="32" height="44">
      <path d="M16 0C7.163 0 0 7.163 0 16c0 12 16 28 16 28S32 28 32 16C32 7.163 24.837 0 16 0z"
            fill="${color}" stroke="white" stroke-width="2"/>
      <text x="16" y="21" text-anchor="middle" dominant-baseline="middle"
            font-family="Arial,sans-serif" font-size="13" font-weight="bold"
            fill="white">${letter}</text>
    </svg>`,
    className: "",
    iconSize: [32, 44],
    iconAnchor: [16, 44],
    popupAnchor: [0, -44],
  });
}

export default function MapView() {
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
    const letter = CATEGORY_LETTERS[facility.category];
    const icon = makePinIcon(L, color, letter);
    const marker = L.marker([facility.lat, facility.lng], { icon });

    async function onActivate() {
      let f = facility;
      // merge any saved edits from Supabase
      const { data } = await supabase
        .from("facilities")
        .select("*")
        .eq("id", facility.id)
        .single();
      if (data) f = { ...facility, ...data };
      if (!f.address) {
        const address = await reverseGeocode(f.lat, f.lng);
        f = { ...f, address };
      }
      setSelected(f);
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

      const map = L.map(mapContainerRef.current!).setView([34.6937, 135.5023], 13);
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
            {/* mini pin preview */}
            <span
              className="inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-[9px] font-bold flex-shrink-0"
              style={{ backgroundColor: CATEGORY_COLORS[cat] }}
            >
              {CATEGORY_LETTERS[cat]}
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
