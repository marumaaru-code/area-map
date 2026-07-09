import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, errMessage } from "@/lib/supabase-server";

// GET /api/posts → 20 most recent posts
export async function GET() {
  try {
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from("posts")
      .select("*")
      .order("posted_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (e) {
    return NextResponse.json({ error: errMessage(e) }, { status: 500 });
  }
}

// POST /api/posts → insert a post log, returns the created row
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const db = getSupabaseAdmin();
    const { data, error } = await db.from("posts").insert(body).select().single();
    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: errMessage(e) }, { status: 500 });
  }
}
