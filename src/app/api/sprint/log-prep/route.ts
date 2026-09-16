import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// POST /api/sprint/log-prep { minutes } — add interview-prep minutes to
// TODAY's row of the ACTIVE sprint run. Additive only, history never rewritten.
const payload = z.object({ minutes: z.number().int().min(1).max(960) });

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const parsed = payload.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json({ error: "Minutes (1-960) required." }, { status: 400 });

  const { data: run } = await supabase
    .from("sprint_runs")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "ACTIVE")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!run) return NextResponse.json({ error: "No active sprint run." }, { status: 404 });

  const today = new Date().toISOString().slice(0, 10);
  const { data: day } = await supabase
    .from("sprint_days")
    .select("id,interview_minutes")
    .eq("user_id", user.id)
    .eq("run_id", run.id)
    .eq("day_date", today)
    .maybeSingle();
  if (!day) return NextResponse.json({ error: "Today is not a sprint day." }, { status: 404 });

  const total = (day.interview_minutes ?? 0) + parsed.data.minutes;
  const { error } = await supabase
    .from("sprint_days")
    .update({ interview_minutes: total })
    .eq("id", day.id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Could not save." }, { status: 500 });
  return NextResponse.json({ ok: true, total });
}
