import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase";
import LaytimeListClient from "@/components/laytime/LaytimeListClient";

export const revalidate = 0;

export default async function LaytimePage() {
  if (process.env.NEXT_PUBLIC_ENABLE_LAYTIME_TEST !== "true") {
    redirect("/");
  }
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) redirect("/auth/login");
  const supabase = createServerClient();

  const [calcs, voyages, cps, cargoes] = await Promise.all([
    supabase
      .from("laytime_calculations")
      .select("id, voyage_id, cp_ids, cargo_ids, status, calculation_method, created_at")
      .eq("tenant_id", session.user.tenantId)
      .order("created_at", { ascending: false }),
    supabase
      .from("voyages")
      .select("id, voyage_reference")
      .eq("tenant_id", session.user.tenantId)
      .order("voyage_reference", { ascending: true }),
    supabase
      .from("charter_parties")
      .select("id, name, voyage_id")
      .eq("tenant_id", session.user.tenantId)
      .order("created_at", { ascending: false }),
    supabase
      .from("cargoes")
      .select("id, cargo_name, voyage_id, quantity, unit")
      .eq("tenant_id", session.user.tenantId)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <LaytimeListClient
      initialCalcs={calcs.data || []}
      voyages={voyages.data || []}
      cps={cps.data || []}
      cargoes={cargoes.data || []}
    />
  );
}
