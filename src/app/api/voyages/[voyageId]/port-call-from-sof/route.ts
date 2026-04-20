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

type LoadedVoyage =
  | { voyage: any; error?: undefined }
  | { voyage?: undefined; error: string };

async function loadVoyage(supabase: ReturnType<typeof createServerClient>, voyageId: string): Promise<LoadedVoyage> {
  const { data, error } = await supabase.from("voyages").select("id, tenant_id").eq("id", voyageId).single();
  if (error || !data) return { error: error?.message || "Voyage not found" };
  return { voyage: data };
}

export async function POST(req: Request, { params }: { params: { voyageId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();
  const { voyage, error } = await loadVoyage(supabase, params.voyageId);
  if (error || !voyage) return NextResponse.json({ error: "Voyage not found" }, { status: 404 });
  const voyageAny: any = voyage;

  if (session.user.role !== "super_admin" && session.user.tenantId !== voyageAny.tenant_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let createdPortCallId: string | null = null;
  let createdClaimId: string | null = null;
  try {
    const body = await req.json();
    const summary = body?.summary || {};
    const events = Array.isArray(body?.events) ? body.events : [];

    let portName = summary.port_name || summary.port || summary.terminal;
    const activity = summary.operation_type || summary.activity || null;
    const laycanStart = summary.laycan_start || null;
    const laycanEnd = summary.laycan_end || null;

    if (!portName) portName = "SOF port";

    // Determine sequence within voyage
    let sequence = 1;
    const { data: pcs } = await supabase.from("port_calls").select("sequence").eq("voyage_id", voyageAny.id);
    if (pcs && pcs.length > 0) {
      const maxSeq = Math.max(...pcs.map((p: any) => p.sequence || 0));
      sequence = maxSeq + 1;
    }

    const insertPayload: Record<string, any> = {
      port_name: portName,
      activity,
      voyage_id: voyageAny.id,
      tenant_id: voyageAny.tenant_id || null,
      sequence,
      eta: laycanStart,
      etd: laycanEnd,
    };

    const { data: portCall, error: pcError } = await supabase.from("port_calls").insert(insertPayload).select().single();
    if (pcError || !portCall) {
      console.error("voyage port-call-from-sof insert error", pcError);
      return NextResponse.json({ error: pcError?.message || "Failed to create port call" }, { status: 500 });
    }
    createdPortCallId = portCall.id;

    // Auto-create a draft claim for this port call so events can be stored
    const claimRef = `SOF-${crypto.randomUUID()}`;
    const claimPayload: Record<string, any> = {
      claim_reference: claimRef,
      tenant_id: voyageAny.tenant_id,
      voyage_id: voyageAny.id,
      port_call_id: portCall.id,
      port_name: portName,
      operation_type: activity,
      laycan_start: laycanStart,
      laycan_end: laycanEnd,
      claim_status: "created",
    };

    const { data: claim, error: claimErr } = await supabase.from("claims").insert(claimPayload).select().single();
    if (claimErr || !claim) {
      console.error("voyage port-call-from-sof claim insert error", claimErr);
      return NextResponse.json({ error: claimErr?.message || "Failed to create claim for port call" }, { status: 500 });
    }
    createdClaimId = claim.id;

    // Insert calculation events tied to the new claim/port call
    const rows: any[] = [];
    events.forEach((ev: any, idx: number) => {
      const name = ev.deduction_name || ev.event;
      const from = ev.from_datetime || ev.start;
      const to = ev.to_datetime || ev.end;
      if (!name || !from || !to) return;
      const rate = ev.rate_of_calculation ?? ev.ratePercent ?? 100;
      rows.push({
        claim_id: claim.id,
        tenant_id: voyageAny.tenant_id,
        deduction_name: name,
        from_datetime: from,
        to_datetime: to,
        rate_of_calculation: rate,
        port_call_id: portCall.id,
        time_used: hoursBetween(from, to, rate),
        row_order: idx + 1,
      });
    });

    let savedEvents: any[] = [];
    if (rows.length > 0) {
      const { data: evData, error: evErr } = await supabase.from("calculation_events").insert(rows).select();
      if (evErr) {
        console.error("voyage port-call-from-sof events insert error", evErr);
        return NextResponse.json({ error: evErr.message }, { status: 500 });
      }
      savedEvents = evData || [];
    }

    return NextResponse.json({ port_call: portCall, claim, events: savedEvents });
  } catch (e: any) {
    if (createdClaimId) {
      await supabase.from("calculation_events").delete().eq("claim_id", createdClaimId);
      await supabase.from("claims").delete().eq("id", createdClaimId);
    }
    if (createdPortCallId) {
      await supabase.from("port_calls").delete().eq("id", createdPortCallId);
    }
    console.error("POST /voyages/[voyageId]/port-call-from-sof error", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
