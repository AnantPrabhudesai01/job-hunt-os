import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST — upsert the day's project. COMPLETED is a manual claim by the user
// (confirm button); the API stamps completed_at but never invents tech.
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const runId = Number(b.run_id);
  const day = Number(b.day_number);
  if (!runId || !(day >= 1 && day <= 30))
    return NextResponse.json({ error: "run_id, day_number 1-30 required." }, { status: 400 });
  const status = String(b.status ?? "PLANNED").toUpperCase();
  if (!["PLANNED", "IN_PROGRESS", "COMPLETED"].includes(status))
    return NextResponse.json({ error: "status PLANNED/IN_PROGRESS/COMPLETED." }, { status: 400 });

  const row = {
    user_id: user.id,
    run_id: runId,
    day_number: day,
    name: String(b.name ?? ""),
    category: b.category ? String(b.category) : null,
    problem: b.problem ? String(b.problem) : null,
    tech: b.tech ? String(b.tech) : null,
    repo_url: b.repo_url ? String(b.repo_url) : null,
    demo_url: b.demo_url ? String(b.demo_url) : null,
    readme_done: Boolean(b.readme_done),
    screenshot_url: b.screenshot_url ? String(b.screenshot_url) : null,
    status,
    completed_at: status === "COMPLETED" ? new Date().toISOString() : null,
    lessons: b.lessons ? String(b.lessons) : null,
  };
  const { error } = await supabase
    .from("sprint_projects")
    .upsert(row, { onConflict: "run_id,day_number" });
  if (error) return NextResponse.json({ error: "Project save failed." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
