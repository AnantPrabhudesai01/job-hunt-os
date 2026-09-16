import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SPRINT_LEN } from "@/lib/sprint";

// POST { start_date: "2026-09-15" } — creates the run + 30 day rows.
// Idempotent: an existing ACTIVE run is returned, never duplicated.
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const start = String(body.start_date ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start))
    return NextResponse.json({ error: "start_date YYYY-MM-DD required." }, { status: 400 });

  const { data: existing } = await supabase
    .from("sprint_runs")
    .select("id")
    .eq("status", "ACTIVE")
    .order("id", { ascending: false })
    .limit(1);
  if (existing && existing.length > 0)
    return NextResponse.json({ runId: existing[0].id, reused: true });

  const { data: run, error } = await supabase
    .from("sprint_runs")
    .insert({ user_id: user.id, start_date: start, status: "ACTIVE" })
    .select("id")
    .single();
  if (error || !run) return NextResponse.json({ error: "Run create failed." }, { status: 500 });

  const rows = [];
  const d = new Date(start + "T00:00:00Z");
  for (let n = 1; n <= SPRINT_LEN; n++) {
    rows.push({
      user_id: user.id,
      run_id: run.id,
      day_number: n,
      day_date: d.toISOString().slice(0, 10),
      status: "LOCKED",
    });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  const { error: dayErr } = await supabase.from("sprint_days").insert(rows);
  if (dayErr) return NextResponse.json({ error: "Day rows failed." }, { status: 500 });
  return NextResponse.json({ runId: run.id, reused: false });
}
