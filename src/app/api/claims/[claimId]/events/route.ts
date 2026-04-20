import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";

function hoursBetween(from: string, to: string, rate: number) {
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;
  const hours = (end - start) / (1000 * 60 * 60);
  const multiplier = Number.isFinite(rate) ? rate / 100 : 1;
  return +(hours * multiplier).toFixed(2);
}

type LoadedClaim =
  | { claim: any; error?: undefined }
  | { claim?: undefined; error: string };

async function loadClaim(
  supabase: ReturnType<typeof createServerClient>,
  claimId: string
): Promise<LoadedClaim> {
  // Minimal column selection to avoid schema cache issues; fetch voyage separately.
  const selectFields = [
    "id",
    "tenant_id",
    "voyage_id",
    "claim_reference",
    "demurrage_rate",
    "demurrage_currency",
    "demurrage_after_hours",
    "demurrage_rate_after",
    "despatch_rate_value",
    "despatch_type",
    "despatch_currency",
    "operation_type",
    "port_name",
    "port_call_id",
    "reversible_scope",
    "laycan_start",
    "laycan_end",
    "load_discharge_rate",
    "load_discharge_rate_unit",
    "fixed_rate_duration_hours",
    "reversible",
    "claim_status",
    "laytime_start",
    "laytime_end",
    "nor_tendered_at",
    "nor_accepted_at",
    "loading_start_at",
    "loading_end_at",
    "turn_time_method",
    "term_id",
    "cp_id",
    "reversible_pool_ids",
    "qc_status",
    "qc_reviewer_id",
    "qc_notes",
    "clause_profile",
  ].join(",");

  let { data: claim, error } = await supabase
    .from("claims")
    .select(selectFields)
    .eq("id", claimId)
    .single();

  if (error) {
    const err: any = error;
    const message = String(err?.message || "");
    const shouldFallback =
      err?.code === "42703" ||
      message.includes("schema cache") ||
      message.includes("relationship");
    if (shouldFallback) {
      const fallbackFields = selectFields
        .replace(",clause_profile", "");
      const fallbackFieldsNoNor = fallbackFields.replace(",nor_accepted_at", "");
      const retry = await supabase.from("claims").select(fallbackFieldsNoNor).eq("id", claimId).single();
      claim = retry.data;
      error = retry.error;
    }
  }

  if (error || !claim) return { error: error?.message || "Claim not found" };

  const claimAny: any = claim;

  let voyageData = null;
  let portCallData = null;
  let voyagePortCalls: any[] = [];
  if (claimAny.voyage_id) {
    const { data: voyage, error: voyageError } = await supabase
      .from("voyages")
      .select("id, cargo_quantity, cargo_names(name), charter_parties(name)")
      .eq("id", claimAny.voyage_id)
      .single();
    if (voyageError) {
      console.warn("loadClaim voyage fetch warning", voyageError);
    } else {
      voyageData = voyage;
    }
    const { data: pcs } = await supabase
      .from("port_calls")
      .select("id, port_name, activity, sequence, eta, etd, status, allowed_hours")
      .eq("voyage_id", claimAny.voyage_id)
      .order("sequence", { ascending: true });
    voyagePortCalls = pcs || [];
  }
  if (claimAny.port_call_id) {
    const { data: pc } = await supabase
      .from("port_calls")
      .select("id, port_name, activity, sequence, eta, etd, status, allowed_hours")
      .eq("id", claimAny.port_call_id)
      .maybeSingle();
    if (pc) portCallData = pc;
  }

  const combinedPortCalls = [...voyagePortCalls];
  if (portCallData && !combinedPortCalls.find((p) => p.id === portCallData.id)) {
    combinedPortCalls.push(portCallData);
  }

  const claimObj = typeof claim === "object" && claim !== null ? claim : {};
  let contractLabel: string | null = null;
  if (claimAny.cp_id) {
    const { data: cp } = await supabase
      .from("charter_parties")
      .select("name, cp_number")
      .eq("id", claimAny.cp_id)
      .maybeSingle();
    if (cp) {
      contractLabel = (cp as any).cp_number || (cp as any).name || null;
    }
  }

  return { claim: { ...(claimObj as any), voyages: voyageData, port_calls: combinedPortCalls, contract_label: contractLabel } };
}

export async function GET(
  _req: Request,
  { params }: { params: { claimId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();
  const { claim, error } = await loadClaim(supabase, params.claimId);
  if (error || !claim) {
    return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  }

  const claimAny: any = claim;

  if (
    session.user.role !== "super_admin" &&
    session.user.tenantId !== claimAny.tenant_id
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: events, error: eventsError } = await supabase
    .from("calculation_events")
    .select("*, port_calls(id, port_name, activity)")
    .eq("claim_id", params.claimId)
    .order("row_order", { ascending: true });

  if (eventsError) {
    console.error("Error fetching events", eventsError);
    return NextResponse.json({ error: "Failed to load events" }, { status: 500 });
  }

  // Ensure time_used is always populated for downstream calculations
  const hydratedEvents =
    events?.map((ev: any) => ({
      ...ev,
      time_used:
        ev.time_used ??
        hoursBetween(ev.from_datetime, ev.to_datetime, ev.rate_of_calculation),
    })) ?? [];

  const { data: audit } = await supabase
    .from("calculation_events_audit")
    .select("*")
    .eq("claim_id", params.claimId)
    .order("created_at", { ascending: false })
    .limit(50);

  // Sibling claim summaries (same voyage)
  let siblingSummaries: any[] = [];
  if (claimAny.voyage_id) {
    const { data: sibClaims } = await supabase
      .from("claims")
      .select(
        "id, claim_reference, port_call_id, laytime_start, laytime_end, load_discharge_rate, load_discharge_rate_unit, fixed_rate_duration_hours, reversible_pool_ids, voyages(cargo_quantity), port_calls(id, port_name, activity, sequence, allowed_hours)"
      )
      .eq("voyage_id", claimAny.voyage_id);

    const siblingIds = (sibClaims || []).map((c: any) => c.id);
    let siblingEvents: any[] = [];
    if (siblingIds.length > 0) {
      const { data: evs } = await supabase
        .from("calculation_events")
        .select("id, claim_id, time_used, from_datetime, to_datetime, rate_of_calculation")
        .in("claim_id", siblingIds);
      siblingEvents = evs || [];
    }

    const calcAllowed = (c: any) => {
      const pc = Array.isArray(c.port_calls) ? c.port_calls[0] : c.port_calls;
      const qty = c.voyages?.cargo_quantity || 0;
      if (pc?.allowed_hours !== null && pc?.allowed_hours !== undefined) return Number(pc.allowed_hours);
      if (!c.load_discharge_rate || c.load_discharge_rate <= 0) return null;
      if (c.load_discharge_rate_unit === "per_hour") return qty / c.load_discharge_rate;
      if (c.load_discharge_rate_unit === "fixed_duration") return c.fixed_rate_duration_hours || null;
      return (qty / c.load_discharge_rate) * 24;
    };

    siblingSummaries = (sibClaims || []).map((c: any) => {
      const pc = Array.isArray(c.port_calls) ? c.port_calls[0] : c.port_calls;
      const allowed = calcAllowed(c);
      let base = 0;
      if (c.laytime_start && c.laytime_end) {
        const s = new Date(c.laytime_start).getTime();
        const e = new Date(c.laytime_end).getTime();
        if (!Number.isNaN(s) && !Number.isNaN(e) && e > s) base = (e - s) / 3600000;
      }
      const evs = siblingEvents.filter((ev) => ev.claim_id === c.id);
      const deductions = evs.reduce((sum, ev) => {
        const t =
          ev.time_used ??
          hoursBetween(ev.from_datetime, ev.to_datetime, ev.rate_of_calculation || 100);
        return sum + (t || 0);
      }, 0);
      const used = base > 0 ? Math.max(base - deductions, 0) : deductions;
      return {
        claim_id: c.id,
        claim_reference: c.claim_reference,
        port_call_id: c.port_call_id || null,
        port_name: pc?.port_name || null,
        activity: pc?.activity || null,
        sequence: pc?.sequence || null,
        allowed,
        base_hours: base,
        deductions,
        used,
        reversible_pool_ids: c.reversible_pool_ids || [],
      };
    });
  }

  return NextResponse.json({
    claim,
    events: hydratedEvents,
    audit: audit || [],
    sibling_summaries: siblingSummaries,
  });
}

export async function POST(
  req: Request,
  { params }: { params: { claimId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();
  const { claim, error } = await loadClaim(supabase, params.claimId);
  if (error || !claim) {
    return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  }
  const claimAny: any = claim;

  if (
    session.user.role !== "super_admin" &&
    session.user.tenantId !== claimAny.tenant_id
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      deduction_name,
      from_datetime,
      to_datetime,
      rate_of_calculation = 100,
      port_call_id,
    } = body || {};

    if (!deduction_name || !from_datetime || !to_datetime) {
      return NextResponse.json(
        { error: "deduction_name, from_datetime, and to_datetime are required" },
        { status: 400 }
      );
    }

    const time_used = hoursBetween(from_datetime, to_datetime, rate_of_calculation);
    const row_order = Math.floor(Date.now() / 1000); // fit in int4, stable ordering by creation time

    const insertPayload = {
      claim_id: params.claimId,
      tenant_id: claimAny.tenant_id,
      deduction_name,
      from_datetime,
      to_datetime,
      rate_of_calculation,
      port_call_id: port_call_id || null,
      time_used,
      row_order,
    } as Record<string, any>;

    const { data, error: insertError } = await supabase
      .from("calculation_events")
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting calculation event", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ event: data }, { status: 201 });
  } catch (e: any) {
    console.error("POST /events error", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { claimId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createServerClient();
  const { claim, error } = await loadClaim(supabase, params.claimId);
  if (error || !claim) return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  const claimAny: any = claim;
  if (session.user.role !== "super_admin" && session.user.tenantId !== claimAny.tenant_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const { id, deduction_name, from_datetime, to_datetime, rate_of_calculation = 100, port_call_id } = body || {};
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const { data: existing, error: fetchError } = await supabase.from("calculation_events").select("*").eq("id", id).single();
    if (fetchError || !existing) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    const time_used = hoursBetween(from_datetime || existing.from_datetime, to_datetime || existing.to_datetime, rate_of_calculation);
    const { data, error: updateError } = await supabase
      .from("calculation_events")
      .update({
        deduction_name: deduction_name ?? existing.deduction_name,
        from_datetime: from_datetime ?? existing.from_datetime,
        to_datetime: to_datetime ?? existing.to_datetime,
        rate_of_calculation,
        port_call_id: port_call_id ?? existing.port_call_id,
        time_used,
      })
      .eq("id", id)
      .select()
      .single();
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    return NextResponse.json({ event: data });
  } catch (e: any) {
    console.error("PUT /events error", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { claimId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createServerClient();
  const { claim, error } = await loadClaim(supabase, params.claimId);
  if (error || !claim) return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  const claimAny: any = claim;
  if (session.user.role !== "super_admin" && session.user.tenantId !== claimAny.tenant_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const { id } = body || {};
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const { error: delError } = await supabase.from("calculation_events").delete().eq("id", id);
    if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("DELETE /events error", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Bulk replace events (used by SOF extractor save)
export async function PATCH(
  req: Request,
  { params }: { params: { claimId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createServerClient();
  const { claim, error } = await loadClaim(supabase, params.claimId);
  if (error || !claim) return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  const claimAny: any = claim;
  if (session.user.role !== "super_admin" && session.user.tenantId !== claimAny.tenant_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const incoming = Array.isArray(body?.events) ? body.events : [];
    if (incoming.length === 0) {
      // Delete all events if none provided
      await supabase.from("calculation_events").delete().eq("claim_id", params.claimId);
      return NextResponse.json({ events: [] });
    }

    const { data: existingRows, error: existingError } = await supabase
      .from("calculation_events")
      .select("deduction_name, from_datetime, to_datetime, rate_of_calculation, port_call_id, time_used, row_order")
      .eq("claim_id", params.claimId);
    if (existingError) {
      console.error("PATCH /events backup error", existingError);
    }

    const rows: any[] = [];
    incoming.forEach((ev: any, idx: number) => {
      const name = ev.deduction_name || ev.event;
      const from = ev.from_datetime || ev.start;
      const to = ev.to_datetime || ev.end;
      if (!name || !from || !to) return;
      const rate = ev.rate_of_calculation ?? ev.ratePercent ?? 100;
      rows.push({
        claim_id: params.claimId,
        tenant_id: claimAny.tenant_id,
        deduction_name: name,
        from_datetime: from,
        to_datetime: to,
        rate_of_calculation: rate,
        port_call_id: ev.port_call_id ?? null,
        time_used: hoursBetween(from, to, rate),
        row_order: idx + 1,
      });
    });

    // replace all events for this claim
    await supabase.from("calculation_events").delete().eq("claim_id", params.claimId);
    if (rows.length === 0) return NextResponse.json({ events: [] });

    const { data, error: insertErr } = await supabase.from("calculation_events").insert(rows).select();
    if (insertErr) {
      console.error("PATCH /events insert error", insertErr);
      const restore = (existingRows || []).map((row: any) => ({
        claim_id: params.claimId,
        tenant_id: claimAny.tenant_id,
        deduction_name: row.deduction_name,
        from_datetime: row.from_datetime,
        to_datetime: row.to_datetime,
        rate_of_calculation: row.rate_of_calculation,
        port_call_id: row.port_call_id,
        time_used: row.time_used,
        row_order: row.row_order,
      }));
      if (restore.length > 0) {
        const { error: restoreErr } = await supabase.from("calculation_events").insert(restore);
        if (restoreErr) {
          console.error("PATCH /events restore error", restoreErr);
        }
      }
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ events: data || [] });
  } catch (e: any) {
    console.error("PATCH /events error", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
