import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServerClient();
  const { searchParams } = new URL(req.url);
  const tenantIdParam = searchParams.get("tenantId");
  const tenantId = session.user.role === "super_admin" ? tenantIdParam || null : session.user.tenantId;

  let query = supabase
    .from("charter_parties")
    .select("id, name, cp_number, voyage_id, clause_profile, created_at, tenant_id")
    .order("created_at", { ascending: false });
  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contracts: data || [] });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { name, cp_number, voyage_id, clause_profile, tenant_id } = body || {};
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const tenantIdToUse =
    session.user.role === "super_admin" ? tenant_id : session.user.tenantId;
  if (!tenantIdToUse) return NextResponse.json({ error: "Missing tenant context" }, { status: 400 });

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("charter_parties")
    .insert({
      tenant_id: tenantIdToUse,
      name,
      cp_number: cp_number || null,
      voyage_id: voyage_id || null,
      clause_profile: clause_profile || {},
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contract: data }, { status: 201 });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { id, name, cp_number, voyage_id, clause_profile } = body || {};
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const supabase = createServerClient();
  let query = supabase
    .from("charter_parties")
    .update({
      name,
      cp_number: cp_number || null,
      voyage_id: voyage_id || null,
      clause_profile: clause_profile || {},
    })
    .eq("id", id);

  if (session.user.role !== "super_admin") {
    query = query.eq("tenant_id", session.user.tenantId);
  }

  const { data, error } = await query.select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contract: data });
}
