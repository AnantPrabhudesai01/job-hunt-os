import { createClient } from "@/lib/supabase/server";
import type { MissionRow } from "@/lib/data";
import { needsNudge, todayKey } from "@/lib/followups";
import { FollowupQueue, type QueuedFollowup, type SuggestedNudge } from "./followup-queue";

type JobJoin = { mission_id: string | null; title: string; companies: { name?: string } | { name?: string }[] | null };

type FollowRow = {
  id: number;
  due_date: string | null;
  status: string;
  contact_name: string | null;
  channel: string | null;
  job_id: number | null;
  jobs: JobJoin | JobJoin[] | null;
};

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export type OriginalMail = {
  to: string;
  subject: string;
  at: string | null;
} | null;

const dayMs = 86400000;
const ageDays = (iso: string | null, today: string) => {
  if (!iso) return 99;
  return Math.max(0, Math.floor((new Date(`${today}T00:00:00Z`).getTime() - new Date(iso).getTime()) / dayMs));
};

// Server half of the queue: suggested nudges (engaged 4+ days, none queued)
// + scheduled rows, all from live data. Client half drafts/copies/confirms.
export async function FollowupQueueServer({
  missions,
  follows,
}: {
  missions: MissionRow[];
  follows: FollowRow[];
}) {
  const supabase = await createClient();
  const today = todayKey();
  const queuedJobIds = new Set((follows ?? []).map((f) => f.job_id));

  const candidates = missions.filter((m) => {
    const stage = m.applications[0]?.stage ?? m.status;
    if (!needsNudge(stage)) return false;
    if (queuedJobIds.has(m.id)) return false;
    const last = m.applications[0]?.updated_at ?? m.created_at;
    return ageDays(last, today) >= 4;
  });

  // Contact names: first contact on record for the same company.
  const { data: allContacts } = await supabase.from("contacts").select("name,companies(name)");
  const nameByCompany = new Map<string, string>();
  for (const c of allContacts ?? []) {
    const cn = (c.companies as { name?: string } | null)?.name ?? "";
    const nm = (c as { name?: string }).name ?? "";
    if (cn && nm && !nameByCompany.has(cn)) nameByCompany.set(cn, nm);
  }

  const suggested: SuggestedNudge[] = candidates.map((m) => {
    const last = m.applications[0]?.updated_at ?? m.created_at;
    const co = m.companies?.name ?? "";
    return {
      jobId: m.id,
      missionId: m.mission_id,
      title: m.title,
      company: co,
      stage: m.applications[0]?.stage ?? m.status ?? "",
      daysWaiting: ageDays(last, today),
      contactName: nameByCompany.get(co) ?? null,
    };
  });

  const channels = ["EMAIL", "WHATSAPP", "LINKEDIN", "PHONE"] as const;
  const schedJobIds = (follows ?? []).map((f) => f.job_id).filter((v): v is number => v !== null);
  const { data: drafts } = schedJobIds.length
    ? await supabase
        .from("email_drafts")
        .select("job_id,to_email,subject,created_at,gmail_url")
        .in("job_id", schedJobIds)
        .order("created_at")
    : { data: [] };
  const mailByJob = new Map<number, OriginalMail>();
  const gmailByJob = new Map<number, string>();
  for (const d of drafts ?? []) {
    if (d.job_id != null && !mailByJob.has(d.job_id)) {
      mailByJob.set(d.job_id, { to: d.to_email, subject: d.subject, at: String(d.created_at).slice(0, 10) });
      const g = (d as { gmail_url?: string | null }).gmail_url;
      if (g) gmailByJob.set(d.job_id, g);
    }
  }
  // Mission resumes (wrong-resume BLOCK needs the exact file) + Gmail link state.
  const { data: resumes } = schedJobIds.length
    ? await supabase.from("resume_versions").select("job_id,file_name").in("job_id", schedJobIds).order("id")
    : { data: [] };
  const resumeByJob = new Map<number, string>();
  for (const r of resumes ?? []) {
    if (r.job_id != null && !resumeByJob.has(r.job_id)) resumeByJob.set(r.job_id, r.file_name);
  }
  const { data: gmailAcct } = await supabase.from("gmail_accounts").select("user_id").limit(1);
  const gmailConnected = (gmailAcct ?? []).length > 0;
  const scheduled: QueuedFollowup[] = (follows ?? []).map((f) => {
    const job = one(f.jobs);
    const co = one(job?.companies ?? null);
    return {
      id: f.id,
      jobId: f.job_id,
      missionId: job?.mission_id ?? null,
      title: job?.title ?? "Mission",
      company: co?.name ?? "",
      contactName: f.contact_name,
      channel: (channels as readonly string[]).includes(f.channel ?? "")
        ? (f.channel as (typeof channels)[number])
        : "EMAIL",
      dueDate: f.due_date,
      daysWaiting: 4,
      originalMail: f.job_id != null ? (mailByJob.get(f.job_id) ?? null) : null,
      gmailUrl: f.job_id != null ? (gmailByJob.get(f.job_id) ?? null) : null,
      resumeFile: f.job_id != null ? (resumeByJob.get(f.job_id) ?? null) : null,
    };
  });

  return <FollowupQueue suggested={suggested} scheduled={scheduled} gmailConnected={gmailConnected} />;
}
