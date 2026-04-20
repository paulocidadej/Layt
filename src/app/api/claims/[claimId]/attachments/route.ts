import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";

async function loadClaim(supabase: ReturnType<typeof createServerClient>, claimId: string) {
  const { data, error } = await supabase
    .from("claims")
    .select("id, tenant_id, qc_reviewer_id, claim_reference")
    .eq("id", claimId)
    .single();
  if (error || !data) return null;
  return data;
}

const BUCKET = "claim-attachments";

async function ensureBucket(supabase: ReturnType<typeof createServerClient>) {
  const { data: bucket } = await supabase.storage.getBucket(BUCKET);
  if (!bucket) {
    await supabase.storage.createBucket(BUCKET, { public: false });
  } else if (bucket.public) {
    await supabase.storage.updateBucket(BUCKET, { public: false });
  }
}

function extractStoragePath(fileUrl: string) {
  const match = fileUrl.match(/claim-attachments\/([^?]+)/);
  if (!match || !match[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export async function GET(_req: Request, { params }: { params: { claimId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServerClient();
  const claim = await loadClaim(supabase, params.claimId);
  if (!claim) return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  if (session.user.role !== "super_admin" && session.user.tenantId !== claim.tenant_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const signer = serviceKey && supabaseUrl ? createClient(supabaseUrl, serviceKey) : null;

  const { data, error } = await supabase
    .from("claim_attachments")
    .select("*")
    .eq("claim_id", params.claimId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Optionally sign URLs for private buckets; currently bucket is public, but signing helps iframe reliability.
  const attachments = await Promise.all(
    (data || []).map(async (att) => {
      if (!signer || !att.file_url) return att;
      // Robust path extraction: look for ".../claim-attachments/<path>"
      const path = extractStoragePath(att.file_url);
      if (!path) return att;
      const { data: signed, error: signErr } = await signer.storage.from(BUCKET).createSignedUrl(path, 60 * 60); // 1 hour
      if (signErr || !signed?.signedUrl) return att;
      return { ...att, signed_url: signed.signedUrl, file_url: signed.signedUrl };
    })
  );

  return NextResponse.json({ attachments });
}

export async function POST(req: Request, { params }: { params: { claimId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServerClient();
  const claim = await loadClaim(supabase, params.claimId);
  if (!claim) return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  if (session.user.role !== "super_admin" && session.user.tenantId !== claim.tenant_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const attachment_type = (form.get("attachment_type") as string) || "other";
  if (!file) return NextResponse.json({ error: "File is required" }, { status: 400 });

  await ensureBucket(supabase);
  const ext = file.name.split(".").pop() || "bin";
  const storagePath = `${claim.tenant_id}/${params.claimId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (uploadError) {
    console.error("Upload error", uploadError);
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

  const { data, error } = await supabase
    .from("claim_attachments")
    .insert({
      claim_id: params.claimId,
      tenant_id: claim.tenant_id,
      attachment_type,
      filename: file.name,
      file_url: publicUrl?.publicUrl || "",
      file_size: file.size,
      uploaded_by: session.user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const signer = serviceKey && supabaseUrl ? createClient(supabaseUrl, serviceKey) : null;
  let attachment = data;
  if (signer) {
    const { data: signed, error: signErr } = await signer.storage.from(BUCKET).createSignedUrl(storagePath, 60 * 60);
    if (!signErr && signed?.signedUrl) {
      attachment = { ...data, signed_url: signed.signedUrl, file_url: signed.signedUrl };
    }
  }

  // Notify assigned reviewer
  let notifyMeta: { ok: boolean; error?: string } | null = null;
  try {
    if (claim.qc_reviewer_id) {
      const doInsert = async (withClaim: boolean) =>
        supabase.from("notifications").insert({
          user_id: claim.qc_reviewer_id as string,
          tenant_id: claim.tenant_id,
          claim_id: withClaim ? claim.id : null,
          title: "New attachment uploaded",
          body: `Claim ${claim.claim_reference || ""} has a new ${attachment_type.toUpperCase()} attachment (${file.name}).`,
          level: "info",
        });
      let { error: nErr } = await doInsert(true);
      if (nErr && (nErr as any).code === "42703") {
        const retry = await doInsert(false);
        nErr = retry.error;
      }
      notifyMeta = nErr ? { ok: false, error: nErr.message } : { ok: true };
    }
  } catch (notifyErr) {
    console.error("Attachment notification failed", notifyErr);
    const errMsg = typeof notifyErr === "object" && notifyErr && "message" in notifyErr ? (notifyErr as any).message : "notify failed";
    notifyMeta = { ok: false, error: errMsg };
  }

  return NextResponse.json({ attachment }, { status: 201 });
}

export async function DELETE(req: Request, { params }: { params: { claimId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createServerClient();
  const claim = await loadClaim(supabase, params.claimId);
  if (!claim) return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  if (session.user.role !== "super_admin" && session.user.tenantId !== claim.tenant_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { id } = body || {};
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { data: attachment, error: fetchError } = await supabase
    .from("claim_attachments")
    .select("*")
    .eq("id", id)
    .single();
  if (fetchError || !attachment) {
    return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
  }

  // Try deleting file (ignore errors)
  // Try to derive path from stored public URL
  const url = attachment.file_url || "";
  const path = extractStoragePath(url);
  if (path) {
    await supabase.storage.from(BUCKET).remove([path]);
  }
  await supabase.from("claim_attachments").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
