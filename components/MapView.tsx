"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { Facility, FacilityCategory } from "@/types";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "@/types";
import { fetchOverpassFacilities, reverseGeocode } from "@/lib/overpass";
import { supabase } from "@/lib/supabase";
import FacilityPanel from "./FacilityPanel";
import AddFacilityModal from "./AddFacilityModal";

// Leaflet is browser-only; loaded dynamically
let L: typeof import("leaflet");

function makePinIcon(color: string) {
  return L.divIcon({
    html: `<svg viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg" width="24" height="36">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24C24 5.373 18.627 0 12 0z" fill="${color}" stroke="white" stroke-width="1.5"/>
      <circle cx="12" cy="12" r="5" fill="white"/>
    </svg>`,
    className: "",
    iconSize: [24, 36],
    iconAnchor: [12, 36],
    popupAnchor: [0, -36],
  });
}

const DEBOUNCE_MS = 800;
const ACTIVE_CATEGORIES = Object.keys(CATEGORY_COLORS) as FacilityCategory[];

export default function MapView() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markersRef = useRef<Map<string, import("leaflet").Marker>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const osmFacilitiesRef = useRef<Map<string, Facility>>(new Map());

  const [selected, setSelected] = useState<Facility | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeCategories, setActiveCategories] = useState<Set<FacilityCategory>>(
    new Set(ACTIVE_CATEGORIES)
  );
  const [loading, setLoading] = useState(false);
  const [manualFacilities, setManualFacilities] = useState<Facility[]>([]);

  // Load manual facilities from Supabase
  useEffect(() => {
    supabase
      .from("facilities")
      .select("*")
      .eq("source", "manual")
      .then(({ data }) => {
        if (data) setManualFacilities(data as Facility[]);
      }, () => {});
  }, []);

  const addOrUpdateMarker = useCallback(
    (facility: Facility, map: import("leaflet").Map) => {
      if (!activeCategories.has(facility.category)) return;
      const existing = markersRef.current.get(facility.id);
      if (existing) return;

      const color = CATEGORY_COLORS[facility.category];
      const icon = makePinIcon(color);
      const marker = L.marker([facility.lat, facility.lng], { icon });
      marker.on("click", async () => {
        let f = facility;
        // Try to load saved data from Supabase
        const { data } = await supabase
          .from("facilities")
          .select("*")
          .eq("id", facility.id)
          .single();
        if (data) f = { ...facility, ...data };
        // Reverse geocode if address missing
        if (!f.address) {
          const address = await reverseGeocode(f.lat, f.lng);
          f = { ...f, address };
        }
        setSelected(f);
      });
      marker.addTo(map);
      markersRef.current.set(facility.id, marker);
    },
    [activeCategories]
  );

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();
  }, []);

  const fetchAndRender = useCallback(
    async (map: import("leaflet").Map) => {
      const bounds = map.getBounds();
      const bbox: [number, number, number, number] = [
        bounds.getSouth(),
        bounds.getWest(),
        bounds.getNorth(),
        bounds.getEast(),
      ];

      // Guard against too-wide bbox to avoid heavy Overpass load
      const latSpan = bbox[2] - bbox[0];
      const lngSpan = bbox[3] - bbox[1];
      if (latSpan > 1 || lngSpan > 1) return;

      setLoading(true);
      try {
        const facilities = await fetchOverpassFacilities(bbox);
        facilities.forEach((f) => {
          osmFacilitiesRef.current.set(f.id, f);
          addOrUpdateMarker(f, map);
        });
        // Also render manual facilities in view
        manualFacilities.forEach((f) => addOrUpdateMarker(f, map));
      } catch (e) {
        console.error("Overpass fetch failed", e);
      } finally {
        setLoading(false);
      }
    },
    [addOrUpdateMarker, manualFacilities]
  );

  // Initialize map
  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;
    import("leaflet").then((leaflet) => {
      L = leaflet;
      // Fix default marker icons (Next.js asset path issue)
      delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapContainerRef.current!).setView([34.6937, 135.5023], 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;

      map.on("moveend", () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => fetchAndRender(map), DEBOUNCE_MS);
      });

      fetchAndRender(map);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-render markers when activeCategories changes
  useEffect(() => {
    if (!mapRef.current) return;
    clearMarkers();
    osmFacilitiesRef.current.forEach((f) => addOrUpdateMarker(f, mapRef.current!));
    manualFacilities.forEach((f) => addOrUpdateMarker(f, mapRef.current!));
  }, [activeCategories, addOrUpdateMarker, clearMarkers, manualFacilities]);

  function toggleCategory(cat: FacilityCategory) {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  function handleFacilityUpdated(updated: Facility) {
    setSelected(updated);
    osmFacilitiesRef.current.set(updated.id, updated);
  }

  function handleFacilityAdded(facility: Facility) {
    setManualFacilities((prev) => [...prev, facility]);
    setShowAddModal(false);
    if (mapRef.current) addOrUpdateMarker(facility, mapRef.current);
  }

  return (
    <div className="flex h-full relative">
      {/* Map */}
      <div className="flex-1 relative">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Category filter */}
        <div className="absolute top-3 left-3 z-[1000] bg-white rounded-lg shadow p-2 space-y-1">
          {ACTIVE_CATEGORIES.map((cat) => (
            <label key={cat} className="flex items-center gap-1.5 cursor-pointer text-xs select-none">
              <span
                className="w-3 h-3 rounded-full inline-block"
                style={{ backgroundColor: CATEGORY_COLORS[cat] }}
              />
              <input
                type="checkbox"
                checked={activeCategories.has(cat)}
                onChange={() => toggleCategory(cat)}
                className="hidden"
              />
              <span className={activeCategories.has(cat) ? "text-gray-800" : "text-gray-400"}>
                {CATEGORY_LABELS[cat]}
              </span>
            </label>
          ))}
        </div>

        {/* Add facility button */}
        <button
          onClick={() => setShowAddModal(true)}
          className="absolute bottom-4 left-3 z-[1000] bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-2 rounded-lg shadow"
        >
          + 施設を手動追加
        </button>

        {/* Loading indicator */}
        {loading && (
          <div className="absolute top-3 right-3 z-[1000] bg-white rounded-full shadow px-3 py-1 text-xs text-gray-500">
            読み込み中...
          </div>
        )}
      </div>

      {/* Side panel */}
      {selected && (
        <div className="w-80 border-l border-gray-200 overflow-hidden flex-shrink-0">
          <FacilityPanel
            facility={selected}
            onClose={() => setSelected(null)}
            onUpdated={handleFacilityUpdated}
          />
        </div>
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
