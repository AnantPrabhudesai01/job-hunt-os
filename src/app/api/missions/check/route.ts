import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normCompany, normTitle, cleanHttpUrl, isPlaceholderUrl } from "@/lib/ingest";

// GET /api/missions/check?postUrl=&jobUrl=&company=&title=
// Live duplicate pre-check for the intake form (same 3-way identity as POST).
// Read-only: never creates anything.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const q = req.nextUrl.searchParams;
  const postRaw = q.get("postUrl") ?? "";
  const jobRaw = q.get("jobUrl") ?? "";
  const postUrl = !isPlaceholderUrl(postRaw) ? cleanHttpUrl(postRaw) : null;
  const jobUrl = !isPlaceholderUrl(jobRaw) ? cleanHttpUrl(jobRaw) : null;

  if (postUrl) {
    const { data } = await supabase
      .from("jobs")
      .select("id")
      .eq("user_id", user.id)
      .eq("linkedin_post_url", postUrl)
      .limit(1);
    if (data && data.length > 0)
      return NextResponse.json({ duplicate: true, jobId: data[0].id, via: "post-url" });
  }
  if (jobUrl) {
    const { data } = await supabase
      .from("jobs")
      .select("id")
      .eq("user_id", user.id)
      .eq("job_url", jobUrl)
      .limit(1);
    if (data && data.length > 0)
      return NextResponse.json({ duplicate: true, jobId: data[0].id, via: "job-url" });
  }
  const company = (q.get("company") ?? "").trim();
  const title = (q.get("title") ?? "").trim();
  if (company && title) {
    const { data: companies } = await supabase
      .from("companies")
      .select("id,name")
      .eq("user_id", user.id);
    const want = normCompany(company);
    const hit = (companies ?? []).find((c) => normCompany(c.name ?? "") === want);
    if (hit) {
      const { data: jobs } = await supabase
        .from("jobs")
        .select("id,title")
        .eq("user_id", user.id)
        .eq("company_id", hit.id)
        .limit(50);
      const wantT = normTitle(title);
      const jhit = (jobs ?? []).find((j) => normTitle(String(j.title ?? "")) === wantT);
      if (jhit) return NextResponse.json({ duplicate: true, jobId: jhit.id, via: "company-title" });
    }
  }
  return NextResponse.json({ duplicate: false });
}
