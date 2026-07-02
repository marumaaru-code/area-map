"use client";

import dynamic from "next/dynamic";

// Leaflet must be loaded client-side only (no SSR)
const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
      地図を読み込み中...
    </div>
  ),
});

export default function MapPage() {
  return <MapView />;
}
