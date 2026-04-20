import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";
import { buildClauseProfile, calculateLaytime } from "@/lib/laytime-engine";

const TEST_ENABLED = process.env.NEXT_PUBLIC_ENABLE_LAYTIME_TEST === "true";

export async function POST(req: Request, { params }: { params: { calcId: string } }) {
  if (!TEST_ENABLED) return NextResponse.json({ error: "Laytime test API disabled" }, { status: 404 });
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createServerClient();
  const { data: calc, error } = await supabase
    .from("laytime_calculations")
    .select("*")
    .eq("id", params.calcId)
    .eq("tenant_id", session.user.tenantId)
    .single();
  if (error || !calc) {
    return NextResponse.json({ error: "Calculation not found" }, { status: 404 });
  }

  const [{ data: portCalls }, { data: cargoes }, { data: cps }, { data: profile }] = await Promise.all([
    supabase.from("port_calls").select("*").eq("voyage_id", calc.voyage_id).order("sequence", { ascending: true }),
    supabase.from("cargoes").select("*").eq("voyage_id", calc.voyage_id).eq("tenant_id", session.user.tenantId),
    supabase.from("charter_parties").select("*").eq("voyage_id", calc.voyage_id).eq("tenant_id", session.user.tenantId),
    calc.profile_id ? supabase.from("laytime_profiles").select("*").eq("id", calc.profile_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const { data: activities } = await supabase
    .from("port_activities")
    .select("*")
    .eq("laytime_calculation_id", params.calcId)
    .eq("tenant_id", session.user.tenantId);

  const { data: deductions } = await supabase
    .from("port_deductions_additions")
    .select("*")
    .eq("laytime_calculation_id", params.calcId)
    .eq("tenant_id", session.user.tenantId);

  const body = await req.json().catch(() => ({}));
  const scope = body.scope || "all_ports";
  const clauseProfile = buildClauseProfile(profile || {}, body?.clauses || {});

  const result = calculateLaytime({
    voyage: {}, // optional stub
    cpList: cps || [],
    cargoes: cargoes || [],
    portCalls: portCalls || [],
    profile: profile || {},
    activities: activities || [],
    deductions: deductions || [],
    method: calc.calculation_method || "STANDARD",
    scope,
    clauseProfile,
    holidays: body?.holidays || [],
    prorationPorts: Array.isArray(body?.prorationPorts) ? body.prorationPorts : [],
    cargoMatchGroups: Array.isArray(body?.cargoMatchGroups) ? body.cargoMatchGroups : [],
  });

  // Persist cargo_port_laytime_rows (replace existing)
  await supabase.from("cargo_port_laytime_rows").delete().eq("laytime_calculation_id", params.calcId).eq("tenant_id", session.user.tenantId);
  if (result.cargoPortRows.length > 0) {
    const portMap = new Map(portCalls?.map((p: any) => [p.id, p]) || []);
    const insertPayload = result.cargoPortRows.map((r) => {
      const port = portMap.get(r.portCallId);
      const op =
        port?.activity === "load"
          ? "LOAD"
          : port?.activity === "discharge"
          ? "DISCHARGE"
          : null;
      return {
        laytime_calculation_id: params.calcId,
        tenant_id: session.user.tenantId,
        cargo_id: r.cargoId,
        port_call_id: r.portCallId,
        operation_type: op,
        laytime_allowed_minutes: r.laytimeAllowedMinutes,
        laytime_used_minutes: r.laytimeUsedMinutes,
        deductions_minutes: r.deductionsMinutes,
        additions_minutes: r.additionsMinutes,
        time_on_demurrage_minutes: r.timeOnDemurrageMinutes,
        time_on_despatch_minutes: r.timeOnDespatchMinutes,
        reversible_group_id: r.reversibleGroupId || null,
        prorate_group_id: r.prorateGroupId || null,
        cargo_match_group_id: r.cargoMatchGroupId || null,
      };
    });
    await supabase.from("cargo_port_laytime_rows").insert(insertPayload);
  }

  // Update totals on laytime_calculations
  await supabase
    .from("laytime_calculations")
    .update({
      time_allowed_minutes: result.totals.timeAllowedMinutes,
      time_used_minutes: result.totals.timeUsedMinutes,
      time_on_demurrage_minutes: result.totals.timeOnDemurrageMinutes,
      time_on_despatch_minutes: result.totals.timeOnDespatchMinutes,
      demurrage_amount: result.totals.demurrageAmount,
      despatch_amount: result.totals.despatchAmount,
    })
    .eq("id", params.calcId)
    .eq("tenant_id", session.user.tenantId);

  return NextResponse.json({ result });
}
