import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", session.user.id)
    .is("read_at", null);

  if (error) {
    console.error("GET /api/notifications/unread error", error);
    return NextResponse.json({ error: "Failed to count unread" }, { status: 500 });
  }

  return NextResponse.json({ unread: count || 0 });
}
