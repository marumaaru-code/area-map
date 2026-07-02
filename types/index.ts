export type FacilityCategory =
  | "construction"
  | "wedding"
  | "roadside_station"
  | "kindergarten"
  | "furniture";

export type FacilitySource = "osm" | "manual";

export interface Facility {
  id: string;
  source: FacilitySource;
  category: FacilityCategory;
  name: string;
  name_ja?: string;
  lat: number;
  lng: number;
  address?: string;
  website?: string;
  instagram_url?: string;
  instagram_username?: string;
  concept_memo?: string;
  created_at?: string;
  updated_at?: string;
}

export interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export interface Post {
  id: string;
  posted_at: string;
  theme: string;
  caption: string;
  format: "reel" | "feed" | "story";
  likes: number;
  saves: number;
  comments: number;
  memo?: string;
}

export interface OwnAccountProfile {
  concept_memo: string;
  target_area: string;
  brand_tone: string;
}

export interface AreaScore {
  area_name: string;
  construction_count: number;
  related_facility_count: number;
  score: number;
  calculated_at: string;
  lat?: number;
  lng?: number;
}

export const CATEGORY_LABELS: Record<FacilityCategory, string> = {
  construction: "工務店・建築会社",
  wedding: "結婚式場",
  roadside_station: "道の駅",
  kindergarten: "保育園",
  furniture: "家具屋",
};

export const CATEGORY_COLORS: Record<FacilityCategory, string> = {
  construction: "#ef4444",
  wedding: "#ec4899",
  roadside_station: "#22c55e",
  kindergarten: "#eab308",
  furniture: "#3b82f6",
};
