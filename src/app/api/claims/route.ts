import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";

async function getTenantPlan(supabase: ReturnType<typeof createServerClient>, tenantId: string) {
  const { data, error } = await supabase
    .from("tenant_plans")
    .select("plan_id, plans(max_claims, max_claims_per_month)")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .single();
  if (error) return null;
  return data;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { role, tenantId: sessionTenantId, id: userId } = session.user;

  try {
    const body = await req.json();
    const {
      voyage_id,
      claim_reference,
      claim_status = "created",
      tenant_id: requestedTenantId,
      operation_type,
      port_name,
      country,
      port_call_id,
      load_discharge_rate,
      load_discharge_rate_unit,
      fixed_rate_duration_hours,
      reversible = false,
      reversible_pool_ids,
      reversible_scope,
      demurrage_rate,
      demurrage_currency,
      demurrage_after_hours,
      demurrage_rate_after,
      despatch_type,
      despatch_rate_value,
      despatch_currency,
      clause_profile,
      laycan_start,
      laycan_end,
      nor_tendered_at,
      nor_accepted_at,
      loading_start_at,
      loading_end_at,
      laytime_start,
      laytime_end,
      turn_time_method,
      term_id,
      cp_id,
    } = body || {};

    if (!voyage_id) {
      return NextResponse.json({ error: "voyage_id is required" }, { status: 400 });
    }

    let tenantIdToUse = sessionTenantId;
    if (role === "super_admin") {
      if (!requestedTenantId) {
        return NextResponse.json({ error: "tenant_id is required for super_admin" }, { status: 400 });
      }
      tenantIdToUse = requestedTenantId;
    } else if (requestedTenantId && requestedTenantId !== sessionTenantId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!tenantIdToUse) {
      return NextResponse.json({ error: "Missing tenant context" }, { status: 400 });
    }

    const supabase = createServerClient();

    // Verify voyage belongs to tenant
    const { data: voyage, error: voyageError } = await supabase
      .from("voyages")
      .select("id, tenant_id, voyage_reference")
      .eq("id", voyage_id)
      .single();

    if (voyageError || !voyage) {
      return NextResponse.json({ error: "Voyage not found" }, { status: 404 });
    }

    if (voyage.tenant_id !== tenantIdToUse && role !== "super_admin") {
      return NextResponse.json({ error: "Voyage does not belong to tenant" }, { status: 403 });
    }

    // Enforce claim limits from plan
    const tenantPlan = await getTenantPlan(supabase, tenantIdToUse);
    const plan = Array.isArray(tenantPlan?.plans) ? tenantPlan.plans[0] : tenantPlan?.plans;
    if (plan?.max_claims) {
      const { count } = await supabase
        .from("claims")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantIdToUse);
      if ((count || 0) >= plan.max_claims) {
        return NextResponse.json({ error: "Claim limit reached for this tenant plan." }, { status: 403 });
      }
    }
    if (plan?.max_claims_per_month) {
      const start = new Date(); start.setDate(1); start.setHours(0,0,0,0);
      const end = new Date(start); end.setMonth(start.getMonth() + 1);
      const { count } = await supabase
        .from("claims")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantIdToUse)
        .gte("created_at", start.toISOString())
        .lt("created_at", end.toISOString());
      if ((count || 0) >= plan.max_claims_per_month) {
        return NextResponse.json({ error: "Monthly claim limit reached for this tenant plan." }, { status: 403 });
      }
    }

    const generatedRef = claim_reference || `CLM-${crypto.randomUUID()}`;

    const insertPayload = {
      claim_reference: generatedRef,
      tenant_id: tenantIdToUse,
      voyage_id,
      port_call_id: port_call_id || null,
      claim_status,
      created_by: userId,
      operation_type,
      port_name,
      country,
      load_discharge_rate,
      load_discharge_rate_unit,
      fixed_rate_duration_hours,
      reversible,
      reversible_scope: reversible_scope || "all_ports",
      demurrage_rate,
      demurrage_currency,
      demurrage_after_hours,
      demurrage_rate_after,
      despatch_type,
      despatch_rate_value,
      despatch_currency,
      clause_profile,
      laycan_start,
      laycan_end,
      nor_tendered_at,
      nor_accepted_at,
      loading_start_at,
      loading_end_at,
      laytime_start,
      laytime_end,
      turn_time_method,
      term_id,
      cp_id,
      reversible_pool_ids: Array.isArray(reversible_pool_ids) ? reversible_pool_ids : [],
    };

    const { data, error } = await supabase
      .from("claims")
      .insert(insertPayload)
      .select("*, voyages(voyage_reference)")
      .single();

    if (error) {
      console.error("Error creating claim", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Sync pooling across claims in the same voyage (only if reversible and pool requested)
    if (reversible && data?.id) {
      const { data: voyageClaims } = await supabase
        .from("claims")
        .select("id")
        .eq("voyage_id", voyage_id);
      const allowedIds = new Set((voyageClaims || []).map((c) => c.id));
      const requestedIds: string[] = Array.isArray(reversible_pool_ids)
        ? reversible_pool_ids.filter((id: any) => typeof id === "string" && allowedIds.has(id))
        : [];
      const pooledArray = Array.from(new Set([data.id, ...requestedIds]));
      if (pooledArray.length > 0) {
        await supabase
          .from("claims")
          .update({ reversible_pool_ids: pooledArray })
          .in("id", pooledArray);
        data.reversible_pool_ids = pooledArray;
      }
    }

    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    console.error("POST /api/claims error", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
