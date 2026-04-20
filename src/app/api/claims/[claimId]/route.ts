import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";

type NotifyResult = { ok: boolean; error?: string };

async function insertNotification(
  supabase: ReturnType<typeof createServerClient>,
  params: { user_id: string; tenant_id?: string | null; claim_id?: string | null; title: string; body: string; level?: string }
): Promise<NotifyResult> {
  try {
    const doInsert = async (withClaim: boolean) =>
      supabase.from("notifications").insert({
        user_id: params.user_id,
        tenant_id: params.tenant_id || null,
        claim_id: withClaim ? params.claim_id || null : null,
        title: params.title,
        body: params.body,
        level: params.level || "info",
      });

    let { error } = await doInsert(true);
    if (error && (error as any).code === "42703") {
      // Missing claim_id column in schema cache; retry without it so we don't silently drop notifications
      const retry = await doInsert(false);
      error = retry.error;
    }
    if (error) {
      console.error("Notification insert failed", error);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err: any) {
    console.error("Notification insert threw", err);
    return { ok: false, error: err?.message || "unknown" };
  }
}

const updatableFields = [
  "claim_status",
  "operation_type",
  "port_name",
  "country",
  "cargo_quantity",
  "load_discharge_rate",
  "load_discharge_rate_unit",
  "fixed_rate_duration_hours",
  "reversible",
  "qc_status",
  "qc_reviewer_id",
  "qc_notes",
  "reversible_pool_ids",
  "demurrage_rate",
  "demurrage_currency",
  "demurrage_after_hours",
  "demurrage_rate_after",
  "despatch_type",
  "despatch_rate_value",
  "despatch_currency",
  "clause_profile",
  "cp_id",
  "laycan_start",
  "laycan_end",
  "nor_tendered_at",
  "nor_accepted_at",
  "loading_start_at",
  "loading_end_at",
  "laytime_start",
  "laytime_end",
  "turn_time_method",
  "term_id",
];

export async function DELETE(
  _req: Request,
  { params }: { params: { claimId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();
  const { data: existing, error: fetchError } = await supabase
    .from("claims")
    .select("id, claim_reference, tenant_id, voyage_id, qc_reviewer_id, qc_status, claim_status")
    .eq("id", params.claimId)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  }

  if (
    session.user.role !== "super_admin" &&
    session.user.tenantId !== existing.tenant_id
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error: delError } = await supabase
    .from("claims")
    .delete()
    .eq("id", params.claimId);

  if (delError) {
    console.error("Error deleting claim", delError);
    return NextResponse.json({ error: delError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function PUT(
  req: Request,
  { params }: { params: { claimId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();

  const { data: existing, error: fetchError } = await supabase
    .from("claims")
    .select("id, tenant_id, voyage_id, qc_reviewer_id, claim_status, qc_status, claim_reference")
    .eq("id", params.claimId)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  }

  if (
    session.user.role !== "super_admin" &&
    session.user.tenantId !== existing.tenant_id
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const payload: Record<string, any> = {};
    let pooledArray: string[] | null = null;
    updatableFields.forEach((field) => {
      if (field in body) payload[field] = body[field];
    });

    // If cargo_quantity is provided, persist it on the voyage (not stored on claim)
    if (body.cargo_quantity !== undefined && existing.voyage_id) {
      const { error: cargoUpdateError } = await supabase
        .from("voyages")
        .update({ cargo_quantity: body.cargo_quantity })
        .eq("id", existing.voyage_id);
      if (cargoUpdateError) {
        console.error("Failed to update cargo_quantity on voyage", cargoUpdateError);
        return NextResponse.json({ error: cargoUpdateError.message }, { status: 500 });
      }
    }

    // Restrict QC edits when a reviewer is assigned (unless super_admin or the assigned reviewer)
    const existingClaim: any = existing;
    const isSuper = session.user.role === "super_admin";
    const requesterId = session.user.id;
    const hasReviewer = !!existingClaim.qc_reviewer_id;
    const isReviewer = existingClaim.qc_reviewer_id === requesterId;

    if (
      (body.qc_status !== undefined || body.qc_notes !== undefined || body.claim_status !== undefined) &&
      hasReviewer &&
      !isSuper &&
      !isReviewer
    ) {
      return NextResponse.json(
        { error: "Only the assigned reviewer (or super admin) can update status/notes." },
        { status: 403 }
      );
    }

    if (
      "qc_reviewer_id" in body &&
      hasReviewer &&
      body.qc_reviewer_id !== existingClaim.qc_reviewer_id &&
      !isSuper &&
      !isReviewer
    ) {
      return NextResponse.json(
        { error: "Only the assigned reviewer or super admin can reassign QC reviewer." },
        { status: 403 }
      );
    }

    // Handle reversible pooling persistence and symmetry within voyage
    if ("reversible_pool_ids" in body) {
      const requestedIds: string[] = Array.isArray(body.reversible_pool_ids)
        ? body.reversible_pool_ids.filter((id: any) => typeof id === "string")
        : [];

      const { data: voyageClaims } = await supabase
        .from("claims")
        .select("id, reversible_pool_ids")
        .eq("voyage_id", existing.voyage_id);

      const allowedIds = new Set((voyageClaims || []).map((c) => c.id));

      // Only keep IDs from same voyage and always include the current claim
      const invalidIds = requestedIds.filter((id) => !allowedIds.has(id));
      pooledArray = Array.from(new Set([existing.id, ...requestedIds.filter((id) => allowedIds.has(id))]));

      // Persist pooled set on all pooled claims
      if (pooledArray.length > 0) {
        const { error: poolUpdateError } = await supabase
          .from("claims")
          .update({ reversible_pool_ids: pooledArray })
          .in("id", pooledArray);
        if (poolUpdateError) {
          console.error("Error updating pooled claims", poolUpdateError);
          return NextResponse.json({ error: poolUpdateError.message }, { status: 500 });
        }
      }

      // Remove current claim from pools it no longer belongs to within this voyage
      const poolList = pooledArray || [];
      const stale = (voyageClaims || []).filter(
        (c) =>
          !poolList.includes(c.id) &&
          Array.isArray(c.reversible_pool_ids) &&
          c.reversible_pool_ids.includes(existing.id)
      );
      for (const staleClaim of stale) {
        const updated = (staleClaim.reversible_pool_ids || []).filter((x: string) => x !== existing.id);
        const { error: cleanupError } = await supabase
          .from("claims")
          .update({ reversible_pool_ids: updated })
          .eq("id", staleClaim.id);
        if (cleanupError) {
          console.error("Error cleaning stale pooled claims", cleanupError);
        }
      }

      // Verify persistence for current claim
      const { data: verify, error: verifyError } = await supabase
        .from("claims")
        .select("reversible_pool_ids")
        .eq("id", existing.id)
        .maybeSingle();
      if (verifyError) {
        console.error("Error verifying pooled claims", verifyError);
        return NextResponse.json({ error: verifyError.message }, { status: 500 });
      }
      payload.reversible_pool_ids = verify?.reversible_pool_ids || pooledArray;
    }

    const { data: updatedRow, error } = await supabase
      .from("claims")
      .update(payload)
      .eq("id", params.claimId)
      .select("id, reversible_pool_ids")
      .maybeSingle();

    if (error) {
      console.error("Error updating claim", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!updatedRow) {
      return NextResponse.json({ error: "Claim not updated" }, { status: 500 });
    }

    // Fire notifications for QC reviewer when assigned or status changes
    const newReviewer = payload.qc_reviewer_id || existingClaim.qc_reviewer_id;
    const reviewerChanged =
      payload.qc_reviewer_id && payload.qc_reviewer_id !== existingClaim.qc_reviewer_id;
    const statusChanged =
      payload.claim_status && payload.claim_status !== existingClaim.claim_status;

    let notifyMeta: NotifyResult | null = null;

    if ((reviewerChanged || statusChanged) && newReviewer) {
      const title = reviewerChanged
        ? `Assigned to ${existingClaim.claim_reference || "claim"}`
        : `Status updated: ${payload.claim_status}`;
      const body = reviewerChanged
        ? `You were assigned as QC reviewer for ${existingClaim.claim_reference || "this claim"}.`
        : `Claim ${existingClaim.claim_reference || ""} moved to ${payload.claim_status}.`;
      notifyMeta = await insertNotification(supabase, {
        user_id: newReviewer,
        tenant_id: existingClaim.tenant_id,
        claim_id: existingClaim.id,
        title,
        body,
        level: reviewerChanged ? "info" : "success",
      });
    }

    // Always notify on explicit status change payload when a reviewer exists (even if value matches), to avoid silent misses.
    if (payload.claim_status !== undefined && newReviewer) {
      const title = `Status update posted`;
      const body = `Claim ${existingClaim.claim_reference || ""} status set to ${payload.claim_status}.`;
      notifyMeta = await insertNotification(supabase, {
        user_id: newReviewer,
        tenant_id: existingClaim.tenant_id,
        claim_id: existingClaim.id,
        title,
        body,
        level: "info",
      });
    }

    return NextResponse.json({
      ok: true,
      reversible_pool_ids:
        (Array.isArray(updatedRow.reversible_pool_ids) && updatedRow.reversible_pool_ids.length > 0
          ? updatedRow.reversible_pool_ids
          : Array.isArray(pooledArray)
          ? pooledArray
          : Array.isArray(payload.reversible_pool_ids)
          ? payload.reversible_pool_ids
          : []) || [],
      invalid_ids: body.reversible_pool_ids?.filter(
        (id: string) => id && !updatedRow.reversible_pool_ids?.includes(id)
      ),
    });
  } catch (e: any) {
    console.error("PUT /api/claims/[claimId] error", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
