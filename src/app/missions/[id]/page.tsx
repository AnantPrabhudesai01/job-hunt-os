import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  ArrowRight,
  FileText,
  Image as ImageIcon,
  Mail,
  ExternalLink,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  objectivesFor,
  nextActionFor,
  difficultyFor,
  DIFF_STARS,
  stageIndex,
  STAGE_ORDER,
} from "@/lib/game";
import { SectionTitle, Stars, XPBar } from "@/components/ui";
import { TimeIntel } from "@/components/time-intel";
import { formatIST, relative, freshness, deadlineStatus } from "@/lib/time";
import { Reveal } from "@/components/reveal";
import { UploadBox, CopyEmail } from "@/components/evidence-ui";
import { EvidenceGallery } from "@/components/evidence-gallery";
import { SourcePanel } from "@/components/source-panel";
import { StatusControl } from "@/components/status-control";
import { OutreachSection } from "@/components/outreach";

type Asset = {
  id: number;
  asset_type: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  local_path: string | null;
  storage_path: string | null;
  sync_status: string;
  source: string | null;
  confidence: string | null;
  notes: string | null;
  created_at: string;
};

type EmailRow = {
  id: number;
  email_address: string;
  email_type: string | null;
  display_name: string | null;
  source: string | null;
  source_detail: string | null;
  confidence: string | null;
  context: string | null;
};

function SyncBadge({ status }: { status: string }) {
  const synced = status === "SYNCED";
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-bold ${
        synced
          ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
          : "border-amber-400/40 bg-amber-400/10 text-amber-200"
      }`}
    >
      {synced ? "☁ SYNCED" : "⚠ LOCAL ONLY"}
    </span>
  );
}

export default async function MissionDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: jobRaw } = await supabase
    .from("jobs")
    .select(
      "*, companies(name,website,location), applications(stage,date_applied,applied_method,email_used,resume_used,xp_earned,created_at)," +
        "resume_versions(file_name,version_label,has_photo,storage_path,created_at)," +
        "email_drafts(to_email,subject,body,status,created_at), interview_preps(status,created_at)",
    )
    .eq("id", id)
    .single();
  if (!jobRaw) notFound();
  type Detail = {
    mission_id: string;
    title: string;
    location: string | null;
    required_skills: string | null;
    status: string | null;
    priority: string | null;
    quality_score: number | null;
    description: string | null;
    job_url: string | null;
    deadline: string | null;
    posted_at: string | null;
    posted_at_display: string | null;
    posted_at_precision: string | null;
    posted_at_confidence: string | null;
    posted_at_source: string | null;
    linkedin_post_url: string | null;
    linkedin_embed_url: string | null;
    source_type: string | null;
    post_author: string | null;
    post_author_role: string | null;
    post_date_display: string | null;
    post_date_note: string | null;
    source: string | null;
    created_at: string;
    companies: { name?: string; website?: string; company_linkedin?: string } | null;
    applications: { stage: string | null; date_applied: string | null; applied_method: string | null; email_used: string | null; resume_used: string | null; created_at: string }[];
    interview_preps: { status: string | null; created_at: string }[];
    resume_versions: {
      file_name: string;
      version_label: string;
      has_photo: boolean;
      storage_path: string | null;
      created_at: string;
    }[];
    email_drafts: { to_email: string; subject: string; body: string | null; status: string; created_at: string }[];
  };
  const job = jobRaw as unknown as Detail;

  const { data: assetRows } = await supabase
    .from("assets")
    .select("*")
    .eq("job_id", Number(id))
    .order("created_at");
  const { data: emailRows } = await supabase
    .from("emails")
    .select("*")
    .eq("job_id", Number(id))
    .order("created_at");
  const companyId =
    (
      await supabase
        .from("jobs")
        .select("company_id")
        .eq("id", id)
        .single()
    ).data?.company_id ?? null;
  const [{ data: companyContacts }, { data: hrForMission }] = await Promise.all([
    companyId
      ? supabase
          .from("contacts")
          .select("name,role_title,email,phone,linkedin_url")
          .eq("company_id", companyId)
      : Promise.resolve({ data: [] as { name: string; role_title: string | null; email: string | null; phone: string | null; linkedin_url: string | null }[] } as const),
    supabase
      .from("hr_outreach")
      .select("id,person_name,role_title,company_name,email,profile_url,status,connect_note")
      .eq("mission_job_id", Number(id))
      .order("created_at", { ascending: false }),
  ]);

  const assets = (assetRows ?? []) as unknown as Asset[];
  const emails = (emailRows ?? []) as unknown as EmailRow[];
  const { data: liRows } = await supabase
    .from("communications")
    .select("id,body,status")
    .eq("job_id", Number(id))
    .eq("channel", "LINKEDIN")
    .order("id", { ascending: false });
  const { data: gmailRow } = await supabase
    .from("gmail_accounts")
    .select("gmail_address")
    .eq("user_id", user.id)
    .single();
  const { data: followRows } = await supabase
    .from("follow_ups")
    .select("due_date,status,contact_name")
    .eq("job_id", Number(id))
    .eq("status", "PENDING")
    .order("due_date");
  const nextFollowup = (followRows ?? [])[0] as
    | { due_date: string | null; status: string; contact_name: string | null }
    | undefined;
  const resumes = job.resume_versions ?? [];
  const drafts = job.email_drafts ?? [];
  const stage = (job.applications?.[0]?.stage ?? job.status) as string;

  // Resume preview: first cloud-synced resume -> fresh signed URL (never stored)
  const BUCKET_RE = /^(resumes|interview-preparation|people-research|company-research|job-descriptions|uploads|application-assets|profile-assets|documents)\//;
  let resumePreview: { name: string; url: string } | null = null;
  const syncedResume = resumes.find((r) => r.storage_path && BUCKET_RE.test(r.storage_path));
  if (syncedResume?.storage_path) {
    const m = syncedResume.storage_path.match(BUCKET_RE)!;
    const bucket = m[1];
    const path = syncedResume.storage_path.slice(bucket.length + 1);
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 600);
    if (data?.signedUrl)
      resumePreview = { name: syncedResume.file_name, url: data.signedUrl };
  }
  const { objectives, progress } = objectivesFor({
    description: job.description,
    resumeCount: resumes.length,
    draftCount: drafts.length,
    stage,
    prepDone: (job.interview_preps ?? []).length > 0,
  });
  const diff = difficultyFor(job.priority, job.quality_score);
  const si = stageIndex(stage);

  // Timeline: authoritative event log (immutable history), fallback to record dates
  const { data: eventRows } = await supabase
    .from("application_events")
    .select("event_type,event_timestamp,source")
    .eq("job_id", Number(id))
    .order("event_timestamp");
  type Ev = { event_type: string; event_timestamp: string; source: string | null };
  const logEvents = ((eventRows ?? []) as unknown as Ev[]).map((e) => ({
    label: e.event_type.replace(/_/g, " "),
    iso: e.event_timestamp,
    sub: e.source ?? undefined,
  }));

  const checks: [string, boolean, string][] = [
    ["Company information", true, job.companies?.name ?? ""],
    ["Job description", Boolean(job.description), ""],
    ["Application URL", Boolean(job.job_url), job.job_url ?? ""],
    ["Recruiter / contact", (companyContacts ?? []).length > 0, ""],
    ["Email", emails.length > 0, emails[0]?.email_address ?? ""],
    ["Resume", resumes.length > 0, resumes[0]?.file_name ?? ""],
    ["Interview prep", (job.interview_preps ?? []).length > 0, ""],
    ["Evidence files", assets.length > 0, `${assets.length} file(s)`],
  ];
  const complete = checks.filter((c) => c[1]).length;

  return (
    <div className="flex flex-col gap-5">
      {/* HEADER */}
      <Reveal>
        <section className="os-panel p-5">
          <p className="font-display text-[11px] font-bold tracking-[0.2em] text-cyan-300">
            MISSION {job.mission_id} · <Stars n={DIFF_STARS[diff]} /> {diff}
          </p>
          <h1 className="font-display mt-1 text-2xl font-bold text-white">
            {job.title}
          </h1>
          <p className="text-sm text-zinc-400">
            {job.companies?.name} · {job.location} · {stage}
          </p>
          {/* TIME INTEL */}
          <TimeIntel
            postedAt={job.posted_at}
            postedDisplay={job.posted_at_display}
            postedPrecision={job.posted_at_precision}
            postedConfidence={job.posted_at_confidence}
            postedSource={job.posted_at_source}
            deadline={job.deadline}
            followupDue={nextFollowup?.due_date ?? null}
            followupWho={nextFollowup?.contact_name ?? null}
          />
          <div className="mt-3">
            <XPBar pct={progress} />
          </div>
          <ol className="mt-3 flex flex-wrap gap-1.5" aria-label="Mission stages">
            {STAGE_ORDER.map((s, i) => (
              <li
                key={s}
                className={`rounded-full border px-2 py-0.5 text-[11px] ${
                  i < si
                    ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                    : i === si
                      ? "border-cyan-400/60 bg-cyan-400/10 font-bold text-cyan-200"
                      : "os-hud-line text-zinc-500"
                }`}
              >
                {s}
              </li>
            ))}
          </ol>
        </section>
      </Reveal>

      {/* APPLICATION STATUS (manual control — user is the authority) */}
      <Reveal delay={0.01}>
        <section className="os-panel border-cyan-400/25 p-5">
          <SectionTitle kicker="CONTROL" title="Application status" />
          <StatusControl
            jobId={Number(id)}
            current={stage}
            dateApplied={job.applications?.[0]?.date_applied ?? null}
            method={job.applications?.[0]?.applied_method ?? null}
            emailUsed={job.applications?.[0]?.email_used ?? null}
            resumeUsed={job.applications?.[0]?.resume_used ?? null}
            emailOptions={emails.map((e) => e.email_address)}
            resumeOptions={resumes.map((r) => r.file_name)}
          />
        </section>
      </Reveal>

      {/* SOURCE INTELLIGENCE */}
      <Reveal delay={0.02}>
        <section className="os-panel p-5">
          <SectionTitle kicker="ORIGIN" title="Source intelligence" />
          <SourcePanel
            sourceType={job.source_type}
            postUrl={job.linkedin_post_url}
            author={job.post_author}
            authorRole={job.post_author_role}
            dateDisplay={job.post_date_display}
            dateNote={job.post_date_note}
            jobUrl={job.job_url}
            companyName={job.companies?.name}
            companyLinkedin={job.companies?.company_linkedin}
          />
        </section>
      </Reveal>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* OBJECTIVES */}
        <Reveal delay={0.03}>
          <section className="os-panel p-5">
            <SectionTitle kicker="ORDERS" title="Objectives" />
            <ul className="flex flex-col gap-2">
              {objectives.map((o) => (
                <li key={o.key} className="flex items-center gap-2 text-sm">
                  {o.done ? (
                    <CheckCircle2 size={16} className="shrink-0 text-emerald-300" aria-hidden />
                  ) : (
                    <Circle size={16} className="shrink-0 text-zinc-600" aria-hidden />
                  )}
                  <span className={o.done ? "text-zinc-400 line-through" : "text-zinc-100"}>
                    {o.label}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 flex items-center gap-1 rounded-lg border border-cyan-400/30 bg-cyan-400/5 p-2.5 text-sm">
              <ArrowRight size={15} className="shrink-0 text-cyan-300" aria-hidden />
              <span>
                NEXT:{" "}
                <strong className="text-white">
                  {nextActionFor({
                    description: job.description,
                    resumeCount: resumes.length,
                    draftCount: drafts.length,
                    stage,
                    prepDone: (job.interview_preps ?? []).length > 0,
                  })}
                </strong>
              </span>
            </p>
          </section>
        </Reveal>

        {/* COMPLETENESS */}
        <Reveal delay={0.05}>
          <section className="os-panel p-5">
            <SectionTitle kicker="INTEL" title={`Evidence completeness ${complete}/${checks.length}`} />
            <ul className="flex flex-col gap-1.5 text-sm">
              {checks.map(([label, ok, detail]) => (
                <li key={label} className="flex items-center justify-between gap-2">
                  <span className="text-zinc-200">{label}</span>
                  {ok ? (
                    <span className="truncate text-xs text-emerald-300">
                      ✓ {detail || "present"}
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-500">NOT FOUND</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </Reveal>
      </div>

      {/* EVIDENCE GALLERY */}
      <Reveal delay={0.07}>
        <section className="os-panel p-5">
          <SectionTitle kicker="VAULT" title={`Evidence (${assets.length})`} />
          <EvidenceGallery
            assets={assets}
            company={job.companies?.name}
            role={job.title}
          />
          {resumePreview && (
            <div className="mt-3">
              <p className="mb-1 text-xs tracking-widest text-zinc-500">
                PDF PREVIEW — {resumePreview.name}
              </p>
              <iframe
                src={resumePreview.url}
                title="Document preview"
                className="h-96 w-full rounded-lg border os-hud-line bg-white"
              />
            </div>
          )}
          <div className="mt-3">
            <UploadBox jobId={Number(id)} />
          </div>
          <div className="mt-3">
            <a
              href={`/api/export/package?jobId=${Number(id)}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-cyan-400/25 px-3 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-400/10"
            >
              ⬇ Export application package (ZIP)
            </a>
            <p className="mt-1 text-[11px] text-zinc-500">
              Resume + mail + prep + summary from the vault — ready to attach.
            </p>
          </div>
        </section>
      </Reveal>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* EMAIL DIRECTORY */}
        <Reveal delay={0.09}>
          <section className="os-panel p-5">
            <SectionTitle kicker="COMMS" title={`Email directory (${emails.length})`} />
            {emails.length === 0 ? (
              <p className="text-sm text-zinc-400">
                No emails on file — NOT FOUND (never invented).
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {emails.map((e) => (
                  <li key={e.id} className="rounded-lg border os-hud-line p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 break-all text-sm font-semibold text-white">
                        <Mail size={14} className="shrink-0 text-cyan-300" aria-hidden />
                        {e.email_address}
                      </span>
                      <CopyEmail email={e.email_address} />
                    </div>
                    <p className="mt-1 text-xs text-zinc-400">
                      {e.email_type}
                      {e.display_name ? ` · ${e.display_name}` : ""} · Confidence:{" "}
                      {e.confidence ?? "—"}
                    </p>
                    {e.source && (
                      <p className="text-xs text-zinc-500">
                        Source: {e.source}
                        {e.source_detail ? ` — ${e.source_detail}` : ""}
                      </p>
                    )}
                    {e.context && <p className="text-xs text-zinc-500">{e.context}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </Reveal>

        {/* LINKED HR — verified contacts linked to this mission (no फालतू rows) */}
        {(hrForMission as unknown as { id: number; person_name: string | null; role_title: string | null; company_name: string | null; email: string | null; profile_url: string; status: string; connect_note: string | null }[]).length > 0 && (
          <Reveal delay={0.10}>
            <section className="os-panel p-5">
              <SectionTitle kicker="OUTREACH" title={`LinkedIn HR for this role (${(hrForMission as unknown as { profile_url: string }[]).filter((h) => h.profile_url).length} verified)`} />
              <p className="mt-1 text-xs text-zinc-400">
                Only verified profiles with a LinkedIn link — blanks are hidden here (see <Link href="/outreach" className="text-cyan-300">Outreach</Link> for the full pipeline). One row = Name · Link · Chat · Mail, all copyable.
              </p>
              <ul className="mt-3 flex flex-col gap-3">
                {(hrForMission as unknown as { id: number; person_name: string | null; role_title: string | null; company_name: string | null; email: string | null; profile_url: string; status: string; connect_note: string | null }[])
                  .filter((h) => h.profile_url)
                  .slice(0, 15)
                  .map((h) => (
                    <li key={h.id} className="rounded-lg border os-hud-line p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-white">{h.person_name ?? "Unnamed HR"}</span>
                        <span className="rounded-full border border-violet-400/30 bg-violet-400/10 px-2 py-0.5 text-[11px] font-bold text-violet-200">{h.status.replace("_", " ")}</span>
                      </div>
                      <p className="text-xs text-zinc-400">
                        {h.role_title ?? "Role unknown"} {h.company_name ? `· ${h.company_name}` : ""}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] font-bold">
                        <a href={h.profile_url} target="_blank" rel="noreferrer" className="rounded border os-hud-line px-2 py-1 text-cyan-200 hover:text-white">
                          LINK ↗
                        </a>
                        <button
                          onClick={() => navigator.clipboard.writeText(h.connect_note ?? "")}
                          disabled={!h.connect_note}
                          className="rounded border os-hud-line px-2 py-1 text-zinc-300 hover:text-white disabled:opacity-40"
                        >
                          COPY CHAT
                        </button>
                        {h.email ? (
                          <a href={`mailto:${h.email}`} className="rounded border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-emerald-200">
                            MAIL {h.email}
                          </a>
                        ) : (
                          <span className="rounded border border-zinc-500/30 px-2 py-1 text-zinc-500">MAIL — not public</span>
                        )}
                      </div>
                    </li>
                  ))}
              </ul>
            </section>
          </Reveal>
        )}

        {/* TIMELINE */}
        <Reveal delay={0.11}>
          <section className="os-panel p-5">
            <SectionTitle kicker="HISTORY" title="Timeline" />
            {logEvents.length === 0 ? (
              <p className="text-sm text-zinc-400">No dated events yet.</p>
            ) : (
              <ol className="flex flex-col gap-0">
                {logEvents.map((e, i) => (
                  <li key={`${e.label}${e.iso}${i}`} className="flex gap-3">
                    <span className="flex flex-col items-center">
                      <span className="mt-1.5 h-2 w-2 rounded-full bg-cyan-300" />
                      {i < logEvents.length - 1 && (
                        <span className="w-px flex-1 bg-zinc-700" />
                      )}
                    </span>
                    <span className="pb-3 text-sm">
                      <span className="font-semibold text-white">{e.label}</span>{" "}
                      <span className="text-xs text-zinc-400" title={e.iso}>
                        {formatIST(e.iso)} · {relative(e.iso)}
                      </span>
                      {e.sub && (
                        <span className="block text-[11px] text-zinc-500">{e.sub}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </Reveal>
      </div>

      {/* LINKEDIN EVIDENCE (dedicated section) */}
      {(job.linkedin_embed_url || job.linkedin_post_url) && (
        <Reveal delay={0.12}>
          <section className="os-panel p-5">
            <SectionTitle kicker="SOURCE" title="LinkedIn post" />
            {job.linkedin_embed_url ? (
              <div className="mx-auto max-w-[504px]">
                <iframe
                  src={job.linkedin_embed_url}
                  height="671"
                  width="100%"
                  title="LinkedIn post embed"
                  loading="lazy"
                  className="rounded-lg border os-hud-line bg-white"
                />
                <p className="mt-1 text-xs text-zinc-500">
                  Official LinkedIn embed ·{" "}
                  <Link
                    href={job.linkedin_post_url ?? job.linkedin_embed_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-300"
                  >
                    Open original post
                  </Link>
                </p>
              </div>
            ) : (
              job.linkedin_post_url && (
                <Link
                  href={job.linkedin_post_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border os-hud-line px-3 py-1.5 text-sm hover:text-white"
                >
                  Open LinkedIn post <ExternalLink size={13} aria-hidden />
                </Link>
              )
            )}
          </section>
        </Reveal>
      )}

      {/* RESUME PREVIEW */}
      <Reveal delay={0.13}>
        <section className="os-panel p-5">
          <div className="flex items-center justify-between">
            <SectionTitle kicker="LOADOUT" title="Resume preview" />
            <a
              href={`/api/export/package?jobId=${id}`}
              className="btn btn-elite text-xs"
            >
              ⬇ EXPORT PACKAGE (.ZIP)
            </a>
          </div>
          {resumePreview ? (
            <>
              <p className="mb-2 text-sm text-zinc-400">{resumePreview.name}</p>
              <iframe
                src={resumePreview.url}
                title="Resume preview"
                className="h-[700px] w-full rounded-lg border os-hud-line bg-white"
              />
            </>
          ) : (
            <p className="text-sm text-zinc-400">
              No cloud-synced resume yet — sync the resume to the vault to preview it here.
              Local copies remain on disk.
            </p>
          )}
        </section>
      </Reveal>

      {/* OUTREACH COMMAND */}
      <Reveal delay={0.135}>
        <OutreachSection
          jobId={Number(id)}
          company={job.companies?.name ?? "Company"}
          role={job.title}
          requiredSkills={job.required_skills ?? null}
          location={job.location ?? null}
          emails={emails.map((e) => ({ address: e.email_address }))}
          resumes={resumes.map((r) => ({ file: r.file_name }))}
          latestDraft={
            drafts.length
              ? {
                  to: drafts[drafts.length - 1].to_email,
                  subject: drafts[drafts.length - 1].subject,
                  body: drafts[drafts.length - 1].body ?? "",
                }
              : null
          }
          gmailConnected={Boolean(gmailRow)}
          gmailAddress={gmailRow?.gmail_address ?? null}
          waContacts={(companyContacts ?? [])
            .filter((c) => c.phone)
            .map((c, i) => ({
              id: i,
              name: c.name,
              phone: c.phone as string,
              source: null,
            }))}
          liNotes={(liRows ?? []).map((n) => ({
            id: n.id,
            body: n.body as string,
            status: n.status as string,
          }))}
          postUrl={job.linkedin_post_url}
        />
      </Reveal>

      {/* LINKS + JD */}
      <Reveal delay={0.14}>
        <section className="os-panel flex flex-wrap gap-2 p-5">
          <Link
            href={`/missions/${id}/brief`}
            className="inline-flex items-center gap-1 rounded-md border border-violet-400/40 bg-violet-400/10 px-3 py-1.5 text-sm font-bold text-violet-200 hover:bg-violet-400/20"
          >
            ★ Interview brief
          </Link>
          {job.job_url && (
            <Link
              href={job.job_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md border os-hud-line px-3 py-1.5 text-sm hover:text-white"
            >
              Job post <ExternalLink size={13} aria-hidden />
            </Link>
          )}
          {(job.companies as { website?: string } | null)?.website && (
            <Link
              href={(job.companies as { website: string }).website}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md border os-hud-line px-3 py-1.5 text-sm hover:text-white"
            >
              Company site <ExternalLink size={13} aria-hidden />
            </Link>
          )}
        </section>
      </Reveal>

      {job.description && (
        <Reveal delay={0.15}>
          <section className="os-panel p-5">
            <SectionTitle kicker="INTEL" title="Job description" />
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
              {job.description}
            </p>
          </section>
        </Reveal>
      )}
    </div>
  );
}
