import type { FacilityCategory, OsmElement, Facility } from "@/types";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

// Scoring weights for area analysis — adjust here to tune rankings
export const AREA_SCORE_WEIGHTS = {
  relatedFacilityWeight: 2,
  constructionPenaltyWeight: 3,
};

function buildQuery(bbox: [number, number, number, number]): string {
  const [south, west, north, east] = bbox;
  const b = `${south},${west},${north},${east}`;
  return `[out:json][timeout:25];
(
  node["craft"="builder"](${b});
  node["office"="construction"](${b});
  node["craft"="carpenter"](${b});
  node["amenity"="events_venue"](${b});
  node["shop"="wedding"](${b});
  node["amenity"="wedding_venue"](${b});
  node["highway"="services"]["name"~"道の駅",i](${b});
  node["tourism"="information"]["name"~"道の駅",i](${b});
  node["amenity"="kindergarten"](${b});
  node["shop"="furniture"](${b});
  way["craft"="builder"](${b});
  way["office"="construction"](${b});
  way["craft"="carpenter"](${b});
  way["amenity"="events_venue"](${b});
  way["shop"="wedding"](${b});
  way["amenity"="wedding_venue"](${b});
  way["highway"="services"]["name"~"道の駅",i](${b});
  way["amenity"="kindergarten"](${b});
  way["shop"="furniture"](${b});
);
out center;`;
}

function classifyElement(tags: Record<string, string>): FacilityCategory | null {
  const name = (tags.name || tags["name:ja"] || "").toLowerCase();

  if (
    tags.craft === "builder" ||
    tags.office === "construction" ||
    tags.craft === "carpenter"
  )
    return "construction";

  if (
    tags.amenity === "events_venue" ||
    tags.shop === "wedding" ||
    tags.amenity === "wedding_venue"
  )
    return "wedding";

  if (name.includes("道の駅") && (tags.highway === "services" || tags.tourism === "information"))
    return "roadside_station";

  if (tags.amenity === "kindergarten") return "kindergarten";

  if (tags.shop === "furniture") return "furniture";

  return null;
}

export function osmElementToFacility(el: OsmElement): Facility | null {
  const tags = el.tags || {};
  const category = classifyElement(tags);
  if (!category) return null;

  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (lat === undefined || lon === undefined) return null;

  return {
    id: `osm-${el.type}-${el.id}`,
    source: "osm",
    category,
    name: tags["name:ja"] || tags.name || "名称不明",
    name_ja: tags["name:ja"],
    lat,
    lng: lon,
    website: tags.website,
  };
}

export async function fetchOverpassFacilities(
  bbox: [number, number, number, number]
): Promise<Facility[]> {
  const query = buildQuery(bbox);
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!res.ok) throw new Error(`Overpass API error: ${res.status}`);

  const json = await res.json();
  const elements: OsmElement[] = json.elements || [];

  return elements
    .map(osmElementToFacility)
    .filter((f): f is Facility => f !== null);
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ja`;
  const res = await fetch(url, {
    headers: { "User-Agent": "instagram-area-tool/1.0" },
  });
  if (!res.ok) return "";
  const json = await res.json();
  return json.display_name || "";
}
