import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase";
import ContractsClient from "@/components/contracts/ContractsClient";

export const revalidate = 0;

async function loadContracts(tenantId?: string | null) {
  const supabase = createServerClient();
  let query = supabase
    .from("charter_parties")
    .select("id, name, cp_number, voyage_id, clause_profile, created_at, tenant_id")
    .order("created_at", { ascending: false });
  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }
  const { data, error } = await query;
  if (error) {
    console.error("Error loading contracts", error);
    return [];
  }
  return data || [];
}

async function loadVoyages(tenantId?: string | null) {
  const supabase = createServerClient();
  let query = supabase
    .from("voyages")
    .select("id, voyage_reference, tenant_id")
    .order("created_at", { ascending: false });
  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }
  const { data, error } = await query;
  if (error) {
    console.error("Error loading voyages", error);
    return [];
  }
  return data || [];
}

export default async function ContractsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/login");

  const tenantId = session.user.role === "super_admin" ? null : session.user.tenantId;
  const [contracts, voyages] = await Promise.all([
    loadContracts(tenantId),
    loadVoyages(tenantId),
  ]);

  return (
    <ContractsClient
      contracts={contracts}
      voyages={voyages}
      isSuperAdmin={session.user.role === "super_admin"}
    />
  );
}
