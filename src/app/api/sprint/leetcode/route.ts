import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { LSLOTS } from "@/lib/sprint";

const SLOTS: Set<string> = new Set(LSLOTS.map((s) => s.slot));

// POST — upsert one slot. A slot existing NEVER means solved;
// status must be explicitly set to SOLVED.
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const runId = Number(b.run_id);
  const day = Number(b.day_number);
  if (!runId || !(day >= 1 && day <= 30) || !SLOTS.has(String(b.slot)))
    return NextResponse.json({ error: "run_id, day_number 1-30, slot L1-L5 required." }, { status: 400 });
  const status = String(b.status ?? "TODO").toUpperCase();
  if (!["TODO", "ATTEMPTED", "SOLVED"].includes(status))
    return NextResponse.json({ error: "status TODO/ATTEMPTED/SOLVED." }, { status: 400 });
  if (status === "SOLVED" && !String(b.title ?? "").trim())
    return NextResponse.json({ error: "Solved needs the actual problem title." }, { status: 400 });

  const row = {
    user_id: user.id,
    run_id: runId,
    day_number: day,
    slot: String(b.slot),
    title: String(b.title ?? ""),
    url: b.url ? String(b.url) : null,
    category: b.category ? String(b.category) : null,
    difficulty: b.difficulty ? String(b.difficulty) : null,
    status,
    attempts: Number(b.attempts ?? 0) || 0,
    time_minutes: Number(b.time_minutes ?? 0) || 0,
    notes: b.notes ? String(b.notes) : null,
    approach: b.approach ? String(b.approach) : null,
    is_review: Boolean(b.is_review),
  };
  const { error } = await supabase
    .from("sprint_leetcode")
    .upsert(row, { onConflict: "run_id,day_number,slot" });
  if (error) return NextResponse.json({ error: "LeetCode save failed." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
