"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { SectionTitle } from "@/components/ui";

const F =
  "w-full rounded-md border os-hud-line bg-zinc-950 px-2.5 py-1.5 text-sm outline-none focus:border-cyan-400";
const L = "flex flex-col gap-1 text-xs text-zinc-400";

type Fields = {
  company: string;
  title: string;
  description: string;
  job_url: string;
  linkedin_post_url: string;
  location: string;
  source: string;
  source_type: string;
  priority: string;
  deadline: string;
  contact_name: string;
  contact_email: string;
  contact_role: string;
  draft_to: string;
  draft_subject: string;
  draft_body: string;
};

const EMPTY: Fields = {
  company: "",
  title: "",
  description: "",
  job_url: "",
  linkedin_post_url: "",
  location: "",
  source: "",
  source_type: "",
  priority: "Medium",
  deadline: "",
  contact_name: "",
  contact_email: "",
  contact_role: "",
  draft_to: "",
  draft_subject: "",
  draft_body: "",
};

export function NewMissionClient() {
  const router = useRouter();
  const params = useSearchParams();
  const [f, setF] = useState<Fields>(() => {
    if (!params) return EMPTY;
    const pick = (k: string) => params.get(k) ?? "";
    return {
      company: pick("company"),
      title: pick("title"),
      description: pick("description"),
      job_url: pick("job_url"),
      linkedin_post_url: pick("linkedin_post_url"),
      location: pick("location"),
      source: pick("source"),
      source_type: pick("source_type"),
      priority: pick("priority") || "Medium",
      deadline: pick("deadline"),
      contact_name: pick("contact_name"),
      contact_email: pick("contact_email"),
      contact_role: pick("contact_role"),
      draft_to: pick("draft_to"),
      draft_subject: pick("draft_subject"),
      draft_body: pick("draft_body"),
    };
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dupe, setDupe] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live duplicate guard: same 3-way identity as the server, checked as you
  // type (debounced). Read-only — warns before you ever hit CREATE.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const { company, title, job_url, linkedin_post_url } = f;
    if (!company.trim() && !job_url.trim() && !linkedin_post_url.trim()) {
      setDupe(null);
      setChecking(false);
      return;
    }
    setChecking(true);
    timer.current = setTimeout(async () => {
      try {
        const qs = new URLSearchParams({
          company: company.trim(),
          title: title.trim(),
          jobUrl: job_url.trim(),
          postUrl: linkedin_post_url.trim(),
        });
        const res = await fetch(`/api/missions/check?${qs.toString()}`);
        const j = await res.json();
        setDupe(j.duplicate && j.jobId ? (j.jobId as number) : null);
      } catch {
        /* check is advisory — submit still enforces server-side */
      } finally {
        setChecking(false);
      }
    }, 450);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.company, f.title, f.job_url, f.linkedin_post_url]);

  const set = (k: keyof Fields) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function submit() {
    setErr(null);
    setDupe(null);
    if (!f.company.trim() || !f.title.trim()) {
      setErr("Company and role title are required.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: f.company,
          title: f.title,
          description: f.description || null,
          job_url: f.job_url || null,
          linkedin_post_url: f.linkedin_post_url || null,
          location: f.location || null,
          source: f.source || null,
          source_type: f.source_type || null,
          priority: f.priority || null,
          deadline: f.deadline || null,
          contact: f.contact_name.trim()
            ? {
                name: f.contact_name,
                email: f.contact_email || null,
                role_title: f.contact_role || null,
              }
            : null,
          draft:
            f.draft_to.trim() && f.draft_subject.trim() && f.draft_body.trim()
              ? {
                  to: f.draft_to,
                  subject: f.draft_subject,
                  body: f.draft_body,
                }
              : null,
        }),
      });
      const j = await res.json();
      if (res.status === 409 && j.jobId) {
        setDupe(j.jobId as number);
        setErr(null);
        return;
      }
      if (!res.ok) throw new Error(j.error ?? "Create failed.");
      router.push(j.href as string);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Create failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle kicker="INTAKE" title="New mission" />
      <p className="text-sm text-zinc-400">
        Paste a job you found. It lands as <strong className="text-zinc-100">NOT APPLIED</strong> with
        a blank applied date — creating it never means applied. Duplicates are blocked, never doubled.
      </p>
      <div className="os-panel grid gap-3 p-4 sm:grid-cols-2">
        <label className={L}>
          COMPANY *
          <input value={f.company} onChange={set("company")} placeholder="e.g. CloudStine" aria-label="Company" className={F} />
        </label>
        <label className={L}>
          ROLE / TITLE *
          <input value={f.title} onChange={set("title")} placeholder="e.g. SAP Roles Walk-In (Fresher)" aria-label="Role title" className={F} />
        </label>
        <label className={`${L} sm:col-span-2`}>
          JOB DESCRIPTION / POST TEXT
          <textarea value={f.description} onChange={set("description")} rows={6} placeholder="Paste the full JD or post text — preserved verbatim" aria-label="Job description" className={`${F} font-mono text-[13px]`} />
        </label>
        <label className={L}>
          JOB / APPLICATION URL
          <input value={f.job_url} onChange={set("job_url")} placeholder="https://…" aria-label="Job URL" className={F} />
        </label>
        <label className={L}>
          LINKEDIN POST URL (exact, never edited)
          <input value={f.linkedin_post_url} onChange={set("linkedin_post_url")} placeholder="https://www.linkedin.com/posts/…" aria-label="LinkedIn post URL" className={F} />
        </label>
        <label className={L}>
          LOCATION (as stated — never inferred)
          <input value={f.location} onChange={set("location")} placeholder="e.g. Kharadi, Pune" aria-label="Location" className={F} />
        </label>
        <label className={L}>
          DEADLINE
          <input type="date" value={f.deadline} onChange={set("deadline")} aria-label="Deadline" className={F} />
        </label>
        <label className={L}>
          SOURCE
          <input value={f.source} onChange={set("source")} placeholder="e.g. LinkedIn Post (company page)" aria-label="Source" className={F} />
        </label>
        <label className={L}>
          PRIORITY
          <select value={f.priority} onChange={set("priority")} aria-label="Priority" className={F}>
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>
        </label>
        <label className={L}>
          CONTACT NAME (optional)
          <input value={f.contact_name} onChange={set("contact_name")} placeholder="Recruiter name, if known" aria-label="Contact name" className={F} />
        </label>
        <label className={L}>
          CONTACT EMAIL (optional)
          <input value={f.contact_email} onChange={set("contact_email")} placeholder="name@company.com" aria-label="Contact email" className={F} />
        </label>
        <label className={`${L} sm:col-span-2`}>
          CONTACT ROLE (optional)
          <input value={f.contact_role} onChange={set("contact_role")} placeholder="e.g. HR Manager" aria-label="Contact role" className={F} />
        </label>
        <label className={L}>
          REPLY DRAFT — TO (optional, saved unsent)
          <input value={f.draft_to} onChange={set("draft_to")} placeholder="recruiter@company.com" aria-label="Draft recipient" className={F} />
        </label>
        <label className={L}>
          REPLY DRAFT — SUBJECT (optional)
          <input value={f.draft_subject} onChange={set("draft_subject")} placeholder="Re: …" aria-label="Draft subject" className={F} />
        </label>
        <label className={`${L} sm:col-span-2`}>
          REPLY DRAFT — BODY (optional, saved as DRAFTED, never auto-sent)
          <textarea value={f.draft_body} onChange={set("draft_body")} rows={5} placeholder="Paste your reply — it lands in Outreach as a draft for you to send yourself" aria-label="Draft body" className={`${F} font-mono text-[13px]`} />
        </label>
      </div>
      {err && <p className="text-sm text-red-300">{err}</p>}
      {checking && <p className="text-xs text-zinc-500">Checking for duplicates…</p>}
      {dupe !== null && (
        <p className="rounded-lg border border-amber-400/50 bg-amber-400/5 p-3 text-sm">
          Matching mission already exists — no duplicate created.{" "}
          <Link href={`/missions/${dupe}`} className="font-bold text-cyan-300">
            Open it →
          </Link>
        </p>
      )}
      <div>
        <button onClick={submit} disabled={busy} className="btn btn-primary text-sm disabled:opacity-40">
          {busy ? "Creating…" : "CREATE MISSION (NOT APPLIED)"}
        </button>
      </div>
    </div>
  );
}
