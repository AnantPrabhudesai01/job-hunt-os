import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  normCompany,
  normTitle,
  cleanHttpUrl,
  isPlaceholderUrl,
  nextMissionId,
  isBlank,
} from "@/lib/ingest";

// POST /api/missions — internal ingestion: Company -> Job -> Application (+ optional Contact).
// Authenticated as the logged-in user, so RLS ownership holds with zero secrets handled.
// Rules enforced server-side, never trust the client:
// - stage is ALWAYS created NOT APPLIED (any client-sent status is ignored)
// - date_applied is ALWAYS NULL on create (only the manual MARK AS APPLIED flow may set it)
// - URLs are validated, never fixed up or invented; workbook placeholders are stored as NULL
// - duplicates return 409 with the existing jobId (company+title / exact job URL / exact post URL)

const contact = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().max(160).nullish(),
  phone: z.string().trim().max(40).nullish(),
  role_title: z.string().trim().max(160).nullish(),
  contact_type: z.string().trim().max(40).nullish(),
  linkedin_url: z.string().trim().max(300).nullish(),
  source: z.string().trim().max(120).nullish(),
});

// Saved as DRAFTED only — intake never sends. Mirrors the manual mailbox flow:
// draft it here, send it yourself, confirm only after it is truly sent.
const draft = z.object({
  to: z.string().trim().email().max(160),
  subject: z.string().trim().min(3).max(200),
  body: z.string().trim().min(10).max(20000),
});

const payload = z.object({
  company: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(20000).nullish(),
  job_url: z.string().trim().max(500).nullish(),
  application_url: z.string().trim().max(500).nullish(),
  linkedin_post_url: z.string().trim().max(500).nullish(),
  location: z.string().trim().max(200).nullish(),
  work_mode: z.string().trim().max(60).nullish(),
  employment_type: z.string().trim().max(60).nullish(),
  experience_requirement: z.string().trim().max(200).nullish(),
  required_skills: z.string().trim().max(2000).nullish(),
  source: z.string().trim().max(120).nullish(),
  source_type: z.string().trim().max(60).nullish(),
  priority: z.string().trim().max(20).nullish(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  post_author: z.string().trim().max(160).nullish(),
  contact: contact.nullish(),
  draft: draft.nullish(),
});

type Db = Awaited<ReturnType<typeof createClient>>;

async function findCompany(supabase: Db, userId: string, name: string) {
  const { data } = await supabase
    .from("companies")
    .select("id,name,website,location")
    .eq("user_id", userId);
  const want = normCompany(name);
  return (data ?? []).find((c) => normCompany(c.name ?? "") === want) ?? null;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const parsed = payload.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  const v = parsed.data;

  const jobUrl = v.job_url && !isPlaceholderUrl(v.job_url) ? cleanHttpUrl(v.job_url) : null;
  if (v.job_url && !isPlaceholderUrl(v.job_url) && !jobUrl)
    return NextResponse.json({ error: "Job URL looks invalid — CHECK LINK." }, { status: 400 });
  const postUrl =
    v.linkedin_post_url && !isPlaceholderUrl(v.linkedin_post_url)
      ? cleanHttpUrl(v.linkedin_post_url)
      : null;
  if (v.linkedin_post_url && !isPlaceholderUrl(v.linkedin_post_url) && !postUrl)
    return NextResponse.json({ error: "LinkedIn post URL looks invalid — CHECK LINK." }, { status: 400 });
  const appUrl =
    v.application_url && !isPlaceholderUrl(v.application_url)
      ? cleanHttpUrl(v.application_url)
      : null;

  // 1) Company: find-or-create (normalized match). Fill blanks only, never overwrite facts.
  let company = await findCompany(supabase, user.id, v.company);
  if (!company) {
    const { data, error } = await supabase
      .from("companies")
      .insert({
        user_id: user.id,
        name: v.company.trim(),
        location: v.location?.trim() || null,
        notes: `Added via mission intake ${new Date().toISOString().slice(0, 10)}.`,
      })
      .select("id,name,website,location")
      .single();
    if (error || !data)
      return NextResponse.json({ error: error?.message ?? "Company create failed." }, { status: 500 });
    company = data;
  } else if (v.location?.trim() && isBlank(company.location)) {
    await supabase
      .from("companies")
      .update({ location: v.location.trim() })
      .eq("id", company.id)
      .eq("user_id", user.id);
  }

  // 2) Job dedup: exact post URL -> exact job URL -> same company + normalized title.
  const dupeOf = async (): Promise<number | null> => {
    if (postUrl) {
      const { data } = await supabase
        .from("jobs")
        .select("id")
        .eq("user_id", user.id)
        .eq("linkedin_post_url", postUrl)
        .limit(1);
      if (data && data.length > 0) return data[0].id as number;
    }
    if (jobUrl) {
      const { data } = await supabase
        .from("jobs")
        .select("id")
        .eq("user_id", user.id)
        .eq("job_url", jobUrl)
        .limit(1);
      if (data && data.length > 0) return data[0].id as number;
    }
    const { data } = await supabase
      .from("jobs")
      .select("id,title")
      .eq("user_id", user.id)
      .eq("company_id", company.id)
      .limit(50);
    const want = normTitle(v.title);
    const hit = (data ?? []).find((j) => normTitle(String(j.title ?? "")) === want);
    return hit ? (hit.id as number) : null;
  };
  const existing = await dupeOf();
  if (existing)
    return NextResponse.json(
      { ok: false, duplicate: true, jobId: existing, message: "Matching mission exists — no duplicate created." },
      { status: 409 },
    );

  // 3) Mission ID: next above highest held (never reuse, never fill backfill gaps).
  const { data: held } = await supabase
    .from("jobs")
    .select("mission_id")
    .eq("user_id", user.id)
    .like("mission_id", "ANANT-%");
  const missionId = nextMissionId((held ?? []).map((h) => h.mission_id as string | null));

  // 4) Job + Application. Stage forced NOT APPLIED; dates/applied_* stay NULL (manual rule).
  const { data: job, error: jobErr } = await supabase
    .from("jobs")
    .insert({
      user_id: user.id,
      company_id: company.id,
      mission_id: missionId,
      title: v.title.trim(),
      location: v.location?.trim() || null,
      work_mode: v.work_mode?.trim() || null,
      employment_type: v.employment_type?.trim() || null,
      experience_requirement: v.experience_requirement?.trim() || null,
      source: v.source?.trim() || "Manual entry",
      source_type: v.source_type?.trim() || null,
      job_url: jobUrl ?? appUrl,
      description: v.description?.trim() || null,
      required_skills: v.required_skills?.trim() || null,
      status: "NOT APPLIED",
      priority: v.priority?.trim() || "Medium",
      deadline: v.deadline ?? null,
      linkedin_post_url: postUrl,
      post_author: v.post_author?.trim() || null,
    })
    .select("id")
    .single();
  if (jobErr || !job)
    return NextResponse.json({ error: jobErr?.message ?? "Job create failed." }, { status: 500 });

  const { data: app, error: appErr } = await supabase
    .from("applications")
    .insert({
      user_id: user.id,
      job_id: job.id,
      mission_id: missionId,
      stage: "NOT APPLIED",
      date_applied: null,
      xp_earned: 0,
      notes: "Created via mission intake. Replying/finding is not applying — flips only on manual MARK AS APPLIED.",
    })
    .select("id")
    .single();
  if (appErr || !app)
    return NextResponse.json({ error: appErr?.message ?? "Application create failed." }, { status: 500 });

  // 5) Optional contact (+ directory email). Status NEW — finding is not contacted.
  let contactId: number | null = null;
  if (v.contact) {
    const li = v.contact.linkedin_url ? cleanHttpUrl(v.contact.linkedin_url) : null;
    const { data: ct, error: ctErr } = await supabase
      .from("contacts")
      .insert({
        user_id: user.id,
        company_id: company.id,
        name: v.contact.name.trim(),
        role_title: v.contact.role_title?.trim() || null,
        contact_type: v.contact.contact_type?.trim() || "OTHER",
        email: v.contact.email?.trim() || null,
        phone: v.contact.phone?.trim() || null,
        linkedin_url: li,
        status: "NEW",
        notes: v.contact.source?.trim()
          ? `Source: ${v.contact.source.trim()}. Finding is not contacted.`
          : "Finding is not contacted.",
      })
      .select("id")
      .single();
    if (ctErr || !ct)
      return NextResponse.json({ error: ctErr?.message ?? "Contact create failed." }, { status: 500 });
    contactId = ct.id as number;
    if (v.contact.email?.trim()) {
      await supabase.from("emails").insert({
        user_id: user.id,
        job_id: job.id,
        company_id: company.id,
        contact_id: contactId,
        email_address: v.contact.email.trim(),
        email_type: "WORK",
        display_name: v.contact.name.trim(),
        source: v.contact.source?.trim() || "Mission intake",
        confidence: "MEDIUM",
        context: v.contact.role_title?.trim() || null,
      });
    }
  }

  // 6) History event (append-only; ingestion, never an application).
  await supabase.from("application_events").insert({
    user_id: user.id,
    job_id: job.id,
    application_id: app.id,
    event_type: "STATUS_SET",
    event_timestamp: new Date().toISOString(),
    timezone: "Asia/Kolkata",
    source: "Mission intake (user)",
    metadata: { from: null, to: "NOT APPLIED", method: "website-form" },
  });

  // 7) Optional outreach draft (recruiter-mail flow). DRAFTED only — intake never
  // sends; the mission detail OutreachSection picks it up as latestDraft automatically.
  if (v.draft) {
    const { error: draftErr } = await supabase.from("email_drafts").insert({
      user_id: user.id,
      job_id: job.id,
      to_email: v.draft.to,
      subject: v.draft.subject,
      body: v.draft.body,
      status: "DRAFTED",
    });
    if (draftErr)
      return NextResponse.json({ error: draftErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    jobId: job.id,
    applicationId: app.id,
    companyId: company.id,
    contactId,
    missionId,
    href: `/missions/${job.id}`,
  });
}
