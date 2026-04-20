import { normalizeSofPayload, RawSofOcrResponse } from "@/lib/sof-parser";
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // Vercel hobby limit

const MAX_TIMEOUT_MS = 295_000; // slightly under 300s to stay within limit

const DEFAULT_OCR_ENDPOINT = "http://localhost:8000/extract";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const envEndpoint = process.env.SOF_OCR_ENDPOINT || process.env.NEXT_PUBLIC_SOF_OCR_ENDPOINT || "";
  const endpoint = envEndpoint || DEFAULT_OCR_ENDPOINT;
  const target = endpoint.includes("/extract") ? endpoint : `${endpoint.replace(/\/+$/, "")}/extract`;

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  const forward = new FormData();
  forward.append("file", file);

  const confidenceFloor = Number(process.env.SOF_CONFIDENCE_FLOOR ?? 0.35);

  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), MAX_TIMEOUT_MS);

    const res = await fetch(target, {
      method: "POST",
      body: forward,
      signal: controller.signal,
    }).catch((err) => {
      throw err;
    });
    clearTimeout(id);

    const text = await res.text();
    let json: RawSofOcrResponse | null = null;
    try {
      json = JSON.parse(text);
    } catch (e) {
      json = null;
    }

    if (!res.ok) {
      const message = (json as any)?.error || text || "SOF service error";
      return NextResponse.json({ error: message }, { status: res.status });
    }
    if (!json || !Array.isArray(json.events)) {
      return NextResponse.json({ error: "Invalid response from SOF service", raw: text }, { status: 502 });
    }

    const normalized = normalizeSofPayload(json, { confidenceFloor });
    normalized.meta = { ...(normalized.meta || {}), confidenceFloor };
    // include original OCR payload for debugging (kept lightweight)
    normalized.raw = json.raw || json;

    // Best-effort: log unmapped labels to Supabase if service role key is present
    try {
      const unmapped = (normalized.events || [])
        .filter((ev: any) => !ev.canonical_event)
        .map((ev: any) => ev.event || ev.deduction_name || ev.notes)
        .filter(Boolean);
      if (unmapped.length > 0 && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const supabase = createServerClient();
        const rows = unmapped.slice(0, 200).map((label: string) => ({
          label: label.toString().trim(),
          count: 1,
          last_seen_at: new Date().toISOString(),
        }));
        await supabase.from("sof_unmapped_labels").upsert(rows, { onConflict: "label" });
      }
    } catch (e) {
      // ignore logging errors
    }

    return NextResponse.json(normalized);
  } catch (err: any) {
    if (err?.name === "AbortError") {
      return NextResponse.json({ error: `SOF service timed out after ${Math.floor(MAX_TIMEOUT_MS / 1000)}s` }, { status: 504 });
    }
    return NextResponse.json({ error: err?.message || "Failed to call SOF service" }, { status: 500 });
  }
}
