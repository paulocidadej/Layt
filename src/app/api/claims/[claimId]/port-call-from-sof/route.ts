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
  const { data: claim, error } = await supabase
    .from("claims")
    .select("id, tenant_id, voyage_id, port_call_id, claim_reference")
    .eq("id", claimId)
    .single();

  if (error || !claim) return { error: error?.message || "Claim not found" };
  return { claim };
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
  if (error || !claim) return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  const claimAny: any = claim;

  if (session.user.role !== "super_admin" && session.user.tenantId !== claimAny.tenant_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let createdPortCallId: string | null = null;
  try {
    const body = await req.json();
    const summary = body?.summary || {};
    const events = Array.isArray(body?.events) ? body.events : [];

    let portName = summary.port_name || summary.port || summary.terminal;
    const activity = summary.operation_type || summary.activity || null;
    const laycanStart = summary.laycan_start || null;
    const laycanEnd = summary.laycan_end || null;

    if (!portName) portName = "SOF port";

    // Determine sequence for this voyage
    let sequence = 1;
    if (claimAny.voyage_id) {
      const { data: pcs } = await supabase
        .from("port_calls")
        .select("sequence")
        .eq("voyage_id", claimAny.voyage_id);
      if (pcs && pcs.length > 0) {
        const maxSeq = Math.max(...pcs.map((p: any) => p.sequence || 0));
        sequence = maxSeq + 1;
      }
    }

    const insertPayload: Record<string, any> = {
      port_name: portName,
      activity,
      voyage_id: claimAny.voyage_id || null,
      tenant_id: claimAny.tenant_id || null,
      sequence,
      eta: laycanStart,
      etd: laycanEnd,
    };

    const { data: portCall, error: pcError } = await supabase
      .from("port_calls")
      .insert(insertPayload)
      .select()
      .single();

    if (pcError || !portCall) {
      console.error("port-call-from-sof insert error", pcError);
      return NextResponse.json({ error: pcError?.message || "Failed to create port call" }, { status: 500 });
    }
    createdPortCallId = portCall.id;

    // Attach new port call to claim
    await supabase
      .from("claims")
      .update({ port_call_id: portCall.id, port_name: portName, laycan_start: laycanStart, laycan_end: laycanEnd, operation_type: activity || null })
      .eq("id", claimAny.id);

    // Replace calculation events for this claim using SOF events
    const rows: any[] = [];
    events.forEach((ev: any, idx: number) => {
      const name = ev.deduction_name || ev.event;
      const from = ev.from_datetime || ev.start;
      const to = ev.to_datetime || ev.end;
      if (!name || !from || !to) return;
      const rate = ev.rate_of_calculation ?? ev.ratePercent ?? 100;
      rows.push({
        claim_id: claimAny.id,
        tenant_id: claimAny.tenant_id,
        deduction_name: name,
        from_datetime: from,
        to_datetime: to,
        rate_of_calculation: rate,
        port_call_id: portCall.id,
        time_used: hoursBetween(from, to, rate),
        row_order: idx + 1,
      });
    });

    await supabase.from("calculation_events").delete().eq("claim_id", claimAny.id);
    let insertedEvents: any[] = [];
    if (rows.length > 0) {
      const { data: evData, error: evErr } = await supabase.from("calculation_events").insert(rows).select();
      if (evErr) {
        console.error("port-call-from-sof events insert error", evErr);
        return NextResponse.json({ error: evErr.message }, { status: 500 });
      }
      insertedEvents = evData || [];
    }

    return NextResponse.json({ port_call: portCall, events: insertedEvents });
  } catch (e: any) {
    if (createdPortCallId) {
      await supabase.from("calculation_events").delete().eq("port_call_id", createdPortCallId);
      await supabase.from("port_calls").delete().eq("id", createdPortCallId);
    }
    console.error("POST /port-call-from-sof error", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
