import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, errMessage } from "@/lib/supabase-server";
import type { Facility } from "@/types";

// GET /api/facilities?id=<id>          → single facility (or null)
// GET /api/facilities?source=manual    → facilities filtered by source
// GET /api/facilities?category=<cat>   → facilities filtered by category
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const source = searchParams.get("source");
  const category = searchParams.get("category");

  try {
    const db = getSupabaseAdmin();

    if (id) {
      const { data, error } = await db
        .from("facilities")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return NextResponse.json(data); // row or null
    }

    let query = db.from("facilities").select("*");
    if (source) query = query.eq("source", source);
    if (category) query = query.eq("category", category);
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (e) {
    return NextResponse.json({ error: errMessage(e) }, { status: 500 });
  }
}

// POST /api/facilities → insert a new facility
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Facility;
    const db = getSupabaseAdmin();
    const now = new Date().toISOString();
    const { data, error } = await db
      .from("facilities")
      .insert({ ...body, created_at: now, updated_at: now })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: errMessage(e) }, { status: 500 });
  }
}

// PUT /api/facilities → upsert (insert-or-update by id). Used for editing both
// OSM facilities (may not exist yet) and manual ones.
export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<Facility> & { id?: string };
    if (!body.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from("facilities")
      .upsert({ ...body, updated_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: errMessage(e) }, { status: 500 });
  }
}
