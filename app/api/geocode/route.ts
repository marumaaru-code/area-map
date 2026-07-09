import { NextRequest, NextResponse } from "next/server";
import { fetchWithRetry, TTLCache, throttleNominatim } from "@/lib/osm-server";

const NOMINATIM = "https://nominatim.openstreetmap.org";

// Nominatim requires a valid identifying User-Agent. This header is *forbidden*
// in browser fetch (silently dropped), which is why the old client-side calls
// were rate-limited so aggressively — here on the server it actually gets sent.
const USER_AGENT =
  "instagram-area-tool/1.0 (https://sho-san.co.jp; contact: sns_div@sho-san.co.jp)";

const reverseCache = new TTLCache<string>(24 * 60 * 60 * 1000); // 1 day
const searchCache = new TTLCache<unknown>(24 * 60 * 60 * 1000); // 1 day

/**
 * GET /api/geocode?reverse=<lat>,<lng>   → { display_name }
 * GET /api/geocode?q=<query>             → Nominatim search results (array)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const reverse = searchParams.get("reverse");
  const q = searchParams.get("q");

  if (reverse) {
    const [latStr, lngStr] = reverse.split(",");
    const lat = Number(latStr);
    const lng = Number(lngStr);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ error: "invalid coordinates" }, { status: 400 });
    }

    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    const cached = reverseCache.get(key);
    if (cached !== undefined) return NextResponse.json({ display_name: cached });

    const url = `${NOMINATIM}/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ja`;
    try {
      const res = await throttleNominatim(() =>
        fetchWithRetry(url, { headers: { "User-Agent": USER_AGENT } }, { retries: 2 })
      );
      if (!res.ok) {
        return NextResponse.json(
          { display_name: "" },
          { status: res.status === 429 ? 429 : 200 }
        );
      }
      const json = await res.json();
      const name: string = json.display_name || "";
      reverseCache.set(key, name);
      return NextResponse.json({ display_name: name });
    } catch {
      return NextResponse.json({ display_name: "" });
    }
  }

  if (q) {
    const key = q.trim().toLowerCase();
    if (!key) return NextResponse.json([]);
    const cached = searchCache.get(key);
    if (cached) return NextResponse.json(cached);

    const url =
      `${NOMINATIM}/search?q=${encodeURIComponent(q)}` +
      `&format=json&limit=6&accept-language=ja&addressdetails=0`;
    try {
      const res = await throttleNominatim(() =>
        fetchWithRetry(url, { headers: { "User-Agent": USER_AGENT } }, { retries: 2 })
      );
      if (!res.ok) {
        return NextResponse.json([], { status: res.status === 429 ? 429 : 200 });
      }
      const json = await res.json();
      searchCache.set(key, json);
      return NextResponse.json(json);
    } catch {
      return NextResponse.json([]);
    }
  }

  return NextResponse.json({ error: "missing 'reverse' or 'q' parameter" }, { status: 400 });
}
