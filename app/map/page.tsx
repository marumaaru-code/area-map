"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
      地図を読み込み中...
    </div>
  ),
});

function MapPageInner() {
  const params = useSearchParams();
  const lat = params.get("lat") ? Number(params.get("lat")) : undefined;
  const lng = params.get("lng") ? Number(params.get("lng")) : undefined;
  const zoom = params.get("zoom") ? Number(params.get("zoom")) : undefined;
  return <MapView initialLat={lat} initialLng={lng} initialZoom={zoom} />;
}

export default function MapPage() {
  return (
    <Suspense fallback={
      <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
        地図を読み込み中...
      </div>
    }>
      <MapPageInner />
    </Suspense>
  );
}
