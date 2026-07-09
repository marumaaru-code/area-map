import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, errMessage } from "@/lib/supabase-server";

// The own-account profile is a single row with a fixed id of 1.
const PROFILE_ID = 1;

// GET /api/profile → the profile row (or null if not saved yet)
export async function GET() {
  try {
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from("own_account_profile")
      .select("*")
      .eq("id", PROFILE_ID)
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json(data); // row or null
  } catch (e) {
    return NextResponse.json({ error: errMessage(e) }, { status: 500 });
  }
}

// PUT /api/profile → upsert the profile
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from("own_account_profile")
      .upsert({ ...body, id: PROFILE_ID, updated_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: errMessage(e) }, { status: 500 });
  }
}
