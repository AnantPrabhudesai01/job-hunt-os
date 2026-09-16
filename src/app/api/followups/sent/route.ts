import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// POST /api/followups/sent — confirm YOU sent a queued nudge (I SENT IT).
// Manual-confirm only; pays +10 XP once (sent_at null-check = idempotent).
const body = z.object({ id: z.number().int(), confirmedSent: z.literal(true) });

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json({ error: "Confirmation required." }, { status: 400 });

  const { data: row } = await supabase
    .from("follow_ups")
    .select("id,status,job_id")
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .single();
  if (!row) return NextResponse.json({ error: "Follow-up not found." }, { status: 404 });
  if (row.status === "SENT")
    return NextResponse.json({ ok: true, reused: true });

  const { error } = await supabase
    .from("follow_ups")
    .update({ status: "SENT", sent_at: new Date().toISOString() })
    .eq("id", row.id)
    .eq("user_id", user.id)
    .is("sent_at", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("xp_transactions").insert({
    user_id: user.id,
    action: "Follow-up sent (manual confirm)",
    xp: 10,
  });
  return NextResponse.json({ ok: true, xp: 10 });
}
