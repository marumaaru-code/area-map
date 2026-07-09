// Client-side data layer. Components call these instead of talking to Supabase
// directly — all DB access goes through our /api/* routes, which use the secret
// key server-side. The browser never holds a key that can write to the database.

import type { Facility, Post, OwnAccountProfile } from "@/types";

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json())?.error ?? "";
    } catch {
      /* ignore */
    }
    throw new Error(`API ${res.status}${detail ? `: ${detail}` : ""}`);
  }
  return res.json() as Promise<T>;
}

// ── facilities ──────────────────────────────────────────────────────────────

export function listFacilities(
  filter: { source?: string; category?: string } = {}
): Promise<Facility[]> {
  const params = new URLSearchParams(
    Object.entries(filter).filter(([, v]) => v) as [string, string][]
  );
  return fetch(`/api/facilities?${params}`).then((r) => asJson<Facility[]>(r));
}

export async function getFacility(id: string): Promise<Facility | null> {
  const res = await fetch(`/api/facilities?id=${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  return (await res.json()) as Facility | null;
}

export function insertFacility(facility: Facility): Promise<Facility> {
  return fetch("/api/facilities", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(facility),
  }).then((r) => asJson<Facility>(r));
}

export function upsertFacility(
  facility: Record<string, unknown> & { id: string }
): Promise<Facility> {
  return fetch("/api/facilities", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(facility),
  }).then((r) => asJson<Facility>(r));
}

// ── posts ───────────────────────────────────────────────────────────────────

export function listPosts(): Promise<Post[]> {
  return fetch("/api/posts").then((r) => asJson<Post[]>(r));
}

export function insertPost(post: Record<string, unknown>): Promise<Post> {
  return fetch("/api/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(post),
  }).then((r) => asJson<Post>(r));
}

// ── own account profile ───────────────────────────────────────────────────────

export async function getProfile(): Promise<OwnAccountProfile | null> {
  const res = await fetch("/api/profile");
  if (!res.ok) throw new Error(`API ${res.status}`);
  return (await res.json()) as OwnAccountProfile | null;
}

export function saveProfile(profile: OwnAccountProfile): Promise<OwnAccountProfile> {
  return fetch("/api/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  }).then((r) => asJson<OwnAccountProfile>(r));
}
