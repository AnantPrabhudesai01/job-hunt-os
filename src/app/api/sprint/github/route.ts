import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST — upsert the day's GitHub record. COMMITTED/VERIFIED requires a real
// commit URL. Never claim a commit that isn't linked.
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
  if (!["PLANNED", "COMMITTED", "VERIFIED"].includes(status))
    return NextResponse.json({ error: "Bad status." }, { status: 400 });
  const commitUrl = b.commit_url ? String(b.commit_url) : null;
  if (["COMMITTED", "VERIFIED"].includes(status) && !commitUrl)
    return NextResponse.json(
      { error: "COMMITTED needs the real commit URL." },
      { status: 400 }
    );

  const row = {
    user_id: user.id,
    run_id: runId,
    day_number: day,
    repo: b.repo ? String(b.repo) : null,
    commit_url: commitUrl,
    commit_hash: b.commit_hash ? String(b.commit_hash) : null,
    commit_message: b.commit_message ? String(b.commit_message) : null,
    pr_url: b.pr_url ? String(b.pr_url) : null,
    project_assoc: b.project_assoc ? String(b.project_assoc) : null,
    status,
  };
  const { error } = await supabase
    .from("sprint_github")
    .upsert(row, { onConflict: "run_id,day_number" });
  if (error) return NextResponse.json({ error: "GitHub save failed." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
