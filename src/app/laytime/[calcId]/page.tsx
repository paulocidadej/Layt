import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase";
import LaytimeCalcClient from "@/components/laytime/LaytimeCalcClient";

export const revalidate = 0;

export default async function LaytimeCalcPage({ params }: { params: { calcId: string } }) {
  if (process.env.NEXT_PUBLIC_ENABLE_LAYTIME_TEST !== "true") {
    redirect("/");
  }
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) redirect("/auth/login");
  const supabase = createServerClient();

  const { data: calc } = await supabase
    .from("laytime_calculations")
    .select("*")
    .eq("id", params.calcId)
    .eq("tenant_id", session.user.tenantId)
    .maybeSingle();
  if (!calc) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600">Laytime calculation not found.</p>
      </div>
    );
  }

  const [portCalls, cargoes, cps, activities, deductions, rows] = await Promise.all([
    supabase
      .from("port_calls")
      .select("id, port_name, activity, sequence, eta, etd, status")
      .eq("voyage_id", calc.voyage_id)
      .order("sequence", { ascending: true }),
    supabase
      .from("cargoes")
      .select("id, cargo_name, quantity, unit, voyage_id")
      .eq("voyage_id", calc.voyage_id)
      .eq("tenant_id", session.user.tenantId),
    supabase
      .from("charter_parties")
      .select("id, name, voyage_id, demurrage_rate_per_day, despatch_rate_per_day, laytime_allowed_value, laytime_allowed_unit")
      .eq("voyage_id", calc.voyage_id)
      .eq("tenant_id", session.user.tenantId),
    supabase
      .from("port_activities")
      .select("*")
      .eq("laytime_calculation_id", params.calcId)
      .eq("tenant_id", session.user.tenantId)
      .order("from_datetime", { ascending: true }),
    supabase
      .from("port_deductions_additions")
      .select("*")
      .eq("laytime_calculation_id", params.calcId)
      .eq("tenant_id", session.user.tenantId)
      .order("created_at", { ascending: true }),
    supabase
      .from("cargo_port_laytime_rows")
      .select("*")
      .eq("laytime_calculation_id", params.calcId)
      .eq("tenant_id", session.user.tenantId)
      .order("created_at", { ascending: true }),
  ]);

  return (
    <LaytimeCalcClient
      calc={calc}
      portCalls={portCalls.data || []}
      cargoes={cargoes.data || []}
      cps={cps.data || []}
      activities={activities.data || []}
      deductions={deductions.data || []}
      rows={rows.data || []}
    />
  );
}
