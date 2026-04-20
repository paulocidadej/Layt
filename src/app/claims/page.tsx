import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase";
import ClaimsClient from "@/components/claims/ClaimsClient";

export const revalidate = 0;

type SearchParams = { [key: string]: string | string[] | undefined };

async function loadClaims(tenantId?: string, search?: string) {
  const supabase = createServerClient();
  let query = supabase
    .from("claims")
    .select(
      [
        "id",
        "claim_reference",
        "claim_status",
        "qc_reviewer_id",
        "qc_reviewer:users!qc_reviewer_id(full_name)",
        "operation_type",
        "port_name",
        "laycan_start",
        "laycan_end",
        "created_at",
        "voyages(voyage_reference)",
        "tenant_id",
      ].join(",")
    )
    .order("created_at", { ascending: false });

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  if (search) {
    query = query.ilike("claim_reference", `%${search}%`);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching claims", error);
    return [];
  }
  return (data || []).map((c: any) => ({
    ...c,
    voyages: Array.isArray(c.voyages) ? c.voyages[0] : c.voyages || null,
    qc_reviewer: Array.isArray(c.qc_reviewer) ? c.qc_reviewer[0] : c.qc_reviewer || null,
  }));
}

async function loadVoyages(tenantId?: string) {
  const supabase = createServerClient();
  let query = supabase
    .from("voyages")
    .select("id, voyage_reference, tenant_id, cargo_quantity, cargo_names(name), charter_parties(name)")
    .order("created_at", { ascending: false });
  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }
  const { data, error } = await query;
  if (error) {
    console.error("Error fetching voyages", error);
    return [];
  }
  return (data || []).map((v: any) => ({
    ...v,
    cargo_names: Array.isArray(v.cargo_names) ? v.cargo_names[0] : v.cargo_names || null,
    charter_parties: Array.isArray(v.charter_parties) ? v.charter_parties[0] : v.charter_parties || null,
  }));
}

export default async function ClaimsPage({ searchParams }: { searchParams?: SearchParams }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/auth/login");
  }

  const search = typeof searchParams?.q === "string" ? searchParams.q : "";
  const requestedTenant = typeof searchParams?.tenantId === "string" ? searchParams.tenantId : undefined;
  const defaultVoyageId = typeof searchParams?.voyageId === "string" ? searchParams.voyageId : undefined;
  const defaultPortCallId = typeof searchParams?.portCallId === "string" ? searchParams.portCallId : undefined;
  const openCreate = searchParams?.openCreate === "1";
  const tenantFilter = session.user.role === "super_admin" ? requestedTenant : session.user.tenantId;

  if (!tenantFilter && session.user.role !== "super_admin") {
    redirect("/auth/login");
  }

  const [claims, voyages] = await Promise.all([
    loadClaims(tenantFilter, search),
    loadVoyages(tenantFilter),
  ]);

  return (
    <ClaimsClient
      claims={claims}
      voyages={voyages}
      search={search}
      isSuperAdmin={session.user.role === "super_admin"}
      tenantIdFilter={tenantFilter || ""}
      defaultVoyageId={defaultVoyageId}
      defaultPortCallId={defaultPortCallId}
      openCreate={openCreate}
    />
  );
}
