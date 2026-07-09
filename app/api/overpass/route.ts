import { NextRequest, NextResponse } from "next/server";
import { buildQuery } from "@/lib/overpass";
import { fetchWithRetry, TTLCache } from "@/lib/osm-server";

// Public Overpass mirrors, tried in order. If one fails (rate-limit, error, or
// unreachable) we fall through to the next rather than failing the request.
const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

// Overpass's frontend returns 406 for requests with a default/bot User-Agent, so
// we must send an identifying UA and an explicit Accept.
const OVERPASS_HEADERS = {
  "Content-Type": "application/x-www-form-urlencoded",
  Accept: "application/json",
  "User-Agent":
    "instagram-area-tool/1.0 (https://sho-san.co.jp; contact: sns_div@sho-san.co.jp)",
};

// Cache results by rounded bbox for 10 minutes. The map fires a query on every
// pan; without this, revisiting the same area re-hits Overpass every time.
const cache = new TTLCache<unknown>(10 * 60 * 1000);

export async function POST(req: NextRequest) {
  const { bbox } = (await req.json()) as { bbox?: number[] };
  if (!Array.isArray(bbox) || bbox.length !== 4 || bbox.some((n) => typeof n !== "number")) {
    return NextResponse.json({ error: "invalid bbox" }, { status: 400 });
  }

  const key = bbox.map((n) => n.toFixed(3)).join(",");
  const cached = cache.get(key);
  if (cached) return NextResponse.json(cached);

  const query = buildQuery(bbox as [number, number, number, number]);
  const body = `data=${encodeURIComponent(query)}`;

  let lastStatus = 0;
  for (const url of MIRRORS) {
    try {
      const res = await fetchWithRetry(
        url,
        { method: "POST", headers: OVERPASS_HEADERS, body },
        { retries: 2 }
      );

      if (res.ok) {
        const json = await res.json(); // throws → caught → next mirror
        cache.set(key, json);
        return NextResponse.json(json);
      }
      lastStatus = res.status;
      // Any non-OK status: mirrors are interchangeable, so try the next one.
    } catch {
      // Network error / non-JSON body — try the next mirror.
    }
  }

  // All mirrors failed. Surface 429 for rate-limits so the client can distinguish.
  const status = lastStatus === 429 ? 429 : 502;
  return NextResponse.json(
    { error: "all overpass mirrors failed", lastStatus },
    { status }
  );
}
