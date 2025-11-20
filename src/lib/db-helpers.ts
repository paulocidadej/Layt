/**
 * Database helper functions with strict tenant isolation
 * All queries automatically filter by tenant_id for security
 */

import { supabase } from "./supabase";
import { Session } from "next-auth";

/**
 * Get Supabase client with tenant context
 * Automatically adds tenant_id filter to all queries
 */
export function getTenantClient(session: Session | null) {
  if (!session?.user?.tenantId) {
    throw new Error("No tenant context available");
  }

  const tenantId = session.user.tenantId;
  const role = session.user.role;

  return {
    // Voyages - tenant isolated
    voyages: {
      list: async (limit = 30) => {
        const query = supabase
          .from("voyages")
          .select(`
            *,
            vessels(name),
            cargo_names(name),
            owner_names(name),
            charterer_names(name),
            charter_parties(name),
            users!voyages_created_by_fkey(full_name)
          `)
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(limit);

        return query;
      },
      get: async (id: string) => {
        const { data, error } = await supabase
          .from("voyages")
          .select("*")
          .eq("id", id)
          .eq("tenant_id", tenantId)
          .single();

        if (error) throw error;
        return data;
      },
      create: async (data: any) => {
        const { data: result, error } = await supabase
          .from("voyages")
          .insert({
            ...data,
            tenant_id: tenantId,
            created_by: session.user.id,
          })
          .select()
          .single();

        if (error) throw error;
        return result;
      },
      update: async (id: string, data: any) => {
        const { data: result, error } = await supabase
          .from("voyages")
          .update(data)
          .eq("id", id)
          .eq("tenant_id", tenantId)
          .select()
          .single();

        if (error) throw error;
        return result;
      },
      delete: async (id: string) => {
        const { error } = await supabase
          .from("voyages")
          .delete()
          .eq("id", id)
          .eq("tenant_id", tenantId);

        if (error) throw error;
      },
    },

    // Claims - tenant isolated
    claims: {
      list: async (limit = 30) => {
        const query = supabase
          .from("claims")
          .select(`
            *,
            voyages(voyage_reference, voyage_number),
            counterparties(name),
            ports(name),
            terms(name),
            cargo_names(name)
          `)
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(limit);

        return query;
      },
      get: async (id: string) => {
        const { data, error } = await supabase
          .from("claims")
          .select("*")
          .eq("id", id)
          .eq("tenant_id", tenantId)
          .single();

        if (error) throw error;
        return data;
      },
      create: async (data: any) => {
        const { data: result, error } = await supabase
          .from("claims")
          .insert({
            ...data,
            tenant_id: tenantId,
            created_by: session.user.id,
          })
          .select()
          .single();

        if (error) throw error;
        return result;
      },
      update: async (id: string, data: any) => {
        const { data: result, error } = await supabase
          .from("claims")
          .update(data)
          .eq("id", id)
          .eq("tenant_id", tenantId)
          .select()
          .single();

        if (error) throw error;
        return result;
      },
    },

    // Lookup data - tenant isolated
    lookup: {
      vessels: async () => {
        const { data, error } = await supabase
          .from("vessels")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("name");

        if (error) throw error;
        return data;
      },
      charterParties: async () => {
        const { data, error } = await supabase
          .from("charter_parties")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("name");

        if (error) throw error;
        return data;
      },
      cargoNames: async () => {
        const { data, error } = await supabase
          .from("cargo_names")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("name");

        if (error) throw error;
        return data;
      },
      ownerNames: async () => {
        const { data, error } = await supabase
          .from("owner_names")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("name");

        if (error) throw error;
        return data;
      },
      chartererNames: async () => {
        const { data, error } = await supabase
          .from("charterer_names")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("name");

        if (error) throw error;
        return data;
      },
      counterparties: async () => {
        const { data, error } = await supabase
          .from("counterparties")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("name");

        if (error) throw error;
        return data;
      },
      ports: async () => {
        const { data, error } = await supabase
          .from("ports")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("name");

        if (error) throw error;
        return data;
      },
      terms: async () => {
        const { data, error } = await supabase
          .from("terms")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("name");

        if (error) throw error;
        return data;
      },
    },

    // Users - only for customer admins and super admins
    users: {
      list: async () => {
        if (role !== "customer_admin" && role !== "super_admin") {
          throw new Error("Unauthorized");
        }

        const { data, error } = await supabase
          .from("users")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return data;
      },
    },
  };
}

