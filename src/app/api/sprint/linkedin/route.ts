import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST — upsert the day's LinkedIn record. MANUAL publishing only:
// PUBLISHED/VERIFIED requires the real post URL or an explicit confirm flag.
// Never fabricate publication.
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
  const status = String(b.status ?? "IDEA").toUpperCase();
  if (!["IDEA", "DRAFTED", "READY", "PUBLISHED", "VERIFIED"].includes(status))
    return NextResponse.json({ error: "Bad status." }, { status: 400 });
  const postUrl = b.post_url ? String(b.post_url) : null;
  if (
    ["PUBLISHED", "VERIFIED"].includes(status) &&
    !postUrl &&
    b.confirmed !== true
  )
    return NextResponse.json(
      { error: "PUBLISHED needs the real post URL or explicit confirm." },
      { status: 400 }
    );

  const row = {
    user_id: user.id,
    run_id: runId,
    day_number: day,
    title: b.title ? String(b.title) : null,
    body: b.body ? String(b.body) : null,
    post_url: postUrl,
    project_assoc: b.project_assoc ? String(b.project_assoc) : null,
    repo_url: b.repo_url ? String(b.repo_url) : null,
    status,
    published_at:
      ["PUBLISHED", "VERIFIED"].includes(status) ? new Date().toISOString() : null,
    screenshot_url: b.screenshot_url ? String(b.screenshot_url) : null,
    engagement: b.engagement ? String(b.engagement) : null,
  };
  const { error } = await supabase
    .from("sprint_linkedin_posts")
    .upsert(row, { onConflict: "run_id,day_number" });
  if (error) return NextResponse.json({ error: "LinkedIn save failed." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
