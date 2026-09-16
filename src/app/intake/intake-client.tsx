"use client";

import { useState } from "react";
import Link from "next/link";
import { extractFromText } from "@/lib/opportunities";
import { SectionTitle, EmptyState } from "@/components/ui";

type Kind = "LINKEDIN" | "EMAIL" | "APPLICATION" | "CAREERS" | "MYPOST";

const KINDS: { key: Kind; label: string; hint: string }[] = [
  { key: "LINKEDIN", label: "+ LINKEDIN POST", hint: "Opportunity post from LinkedIn. URL preserved exactly." },
  { key: "EMAIL", label: "+ EMAIL", hint: "Recruiter mail or conversation. Never marks applied." },
  { key: "APPLICATION", label: "+ JOB APPLICATION", hint: "A posting you will apply to. Stays NOT APPLIED until you confirm." },
  { key: "CAREERS", label: "+ COMPANY CAREERS JOB", hint: "Direct from a company careers page. Source stays Company Careers." },
  { key: "MYPOST", label: "+ MY LINKEDIN POST", hint: "Your own output. Tracked separately from opportunities." },
];

const KIND_SOURCE_TYPE: Record<Exclude<Kind, "MYPOST">, string> = {
  LINKEDIN: "LINKEDIN_POST",
  EMAIL: "EMAIL",
  APPLICATION: "APPLICATION",
  CAREERS: "COMPANY_CAREERS",
};

export function IntakeClient() {
  const [kind, setKind] = useState<Kind>("LINKEDIN");
  const [raw, setRaw] = useState("");
  const [f, setF] = useState({
    company: "", title: "", location: "", author: "", subject: "",
    url1: "", url2: "", email1: "", phone1: "",
  });
  const [extracted, setExtracted] = useState(false);
  const [postTitle, setPostTitle] = useState("");
  const [postType, setPostType] = useState("Build in public");
  const [postDay, setPostDay] = useState("");
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  // Poster OCR: snap/upload a hiring-poster image, machine-read the text into
  // the paste box. Recognition runs on-device (no keys, nothing uploaded).
  // OCR output is MACHINE-READ — it flows through the same extract + review
  // as pasted text, never straight into a record.
  async function scanPoster(file: File) {
    setScanning(true);
    setNote("Reading poster… (first scan downloads the reader, ~30s)");
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      const { data } = await worker.recognize(file);
      await worker.terminate();
      const text = (data.text ?? "").trim();
      if (!text) {
        setNote("No readable text found in that image. Try a clearer screenshot.");
        return;
      }
      setRaw(text);
      setExtracted(false);
      setNote("Poster text loaded below — press EXTRACT & REVIEW, then verify every field. Machine reading makes mistakes.");
    } catch {
      setNote("Reader failed to load (needs internet once). Paste the text by hand instead.");
    } finally {
      setScanning(false);
    }
  }

  function runExtract() {
    const e = extractFromText(raw);
    const liUrl = e.urls.find((u) => u.toLowerCase().includes("linkedin.com")) ?? "";
    const otherUrl = e.urls.find((u) => u !== liUrl) ?? (liUrl ? "" : (e.urls[0] ?? ""));
    setF({
      company: e.company ?? "",
      title: e.role ?? "",
      location: e.location ?? "",
      author: e.author ?? "",
      subject: e.subject ?? "",
      url1: kind === "LINKEDIN" ? (liUrl || e.urls[0] || "") : (e.urls[0] || ""),
      url2: kind === "LINKEDIN" ? otherUrl : "",
      email1: e.emails[0] ?? "",
      phone1: e.phones[0] ?? "",
    });
    setExtracted(true);
    setNote(
      e.company || e.role || e.location
        ? "Extracted from labeled lines — review every field before continuing. Blanks were not found, never guessed."
        : "No labeled Company/Role/Location lines found — fill them in by hand. Nothing was guessed.",
    );
  }

  function missionHref() {
    const st = KIND_SOURCE_TYPE[kind as Exclude<Kind, "MYPOST">];
    const qs = new URLSearchParams({
      company: f.company, title: f.title, description: raw.slice(0, 8000),
      location: f.location, source_type: st,
      source:
        kind === "LINKEDIN" ? `LinkedIn Post${f.author ? ` (${f.author})` : ""}`
        : kind === "EMAIL" ? `Email${f.author ? ` (${f.author})` : ""}`
        : kind === "CAREERS" ? "Company Careers" : "Direct application",
      linkedin_post_url: kind === "LINKEDIN" ? f.url1 : "",
      job_url: kind === "LINKEDIN" ? f.url2 : f.url1,
      contact_name: f.author,
      contact_email: f.email1,
      draft_to: kind === "EMAIL" ? f.email1 : "",
      draft_subject: kind === "EMAIL" ? `Re: ${f.subject || f.title || "your email"}` : "",
    });
    return `/missions/new?${qs.toString()}`;
  }

  async function saveMyPost(status: "DRAFT" | "POSTED") {
    if (!postTitle.trim() && !raw.trim()) {
      setNote("Give the post a title or some text first.");
      return;
    }
    setSaving(true);
    setNote(null);
    try {
      const res = await fetch("/api/my-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: postTitle.trim() || raw.trim().slice(0, 80),
          body: raw.trim().slice(0, 8000),
          post_type: postType,
          challenge_day: postDay ? Number(postDay) : null,
          status,
        }),
      });
      if (!res.ok) {
        setNote("Could not save. Try again.");
        return;
      }
      setRaw("");
      setPostTitle("");
      setPostDay("");
      setNote(status === "DRAFT" ? "Saved as DRAFT. Publish on LinkedIn, then mark it POSTED." : "Recorded as POSTED. Counts toward your output stats.");
    } catch {
      setNote("Network error. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" aria-label="Capture type">
        {KINDS.map((k) => (
          <button
            key={k.key}
            aria-pressed={kind === k.key}
            onClick={() => {
              setKind(k.key);
              setExtracted(false);
              setNote(null);
            }}
            className={`rounded-lg border px-3 py-2 text-xs font-bold tracking-wider ${
              kind === k.key
                ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-200"
                : "os-hud-line text-zinc-400 hover:text-zinc-100"
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-zinc-400">
        {KINDS.find((k) => k.key === kind)?.hint} Paste first — extraction only reads
        what is explicitly there.
      </p>

      <section className="os-panel p-5">
        <SectionTitle kicker="PASTE" title="Raw text" />
        {kind !== "MYPOST" && (
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs font-bold text-violet-300 hover:text-white">
            {scanning ? "SCANNING POSTER…" : "📷 OR SCAN A HIRING POSTER"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={scanning}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) scanPoster(f);
              }}
            />
          </label>
        )}
        <textarea
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            setExtracted(false);
          }}
          placeholder={
            kind === "MYPOST"
              ? "Paste or write your LinkedIn post text…"
              : "Paste the full post / email / job text, including URLs…"
          }
          rows={7}
          className="mt-2 w-full rounded-lg border os-hud-line bg-black/30 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
        />
        {kind !== "MYPOST" ? (
          <button onClick={runExtract} className="btn btn-primary mt-2 text-xs">
            EXTRACT & REVIEW →
          </button>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              value={postTitle}
              onChange={(e) => setPostTitle(e.target.value)}
              placeholder="Post title"
              className="min-w-40 flex-1 rounded-lg border os-hud-line bg-black/30 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
            />
            <input
              value={postType}
              onChange={(e) => setPostType(e.target.value)}
              placeholder="Post type"
              className="w-40 rounded-lg border os-hud-line bg-black/30 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
            />
            <input
              value={postDay}
              onChange={(e) => setPostDay(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
              placeholder="Day #"
              inputMode="numeric"
              className="w-20 rounded-lg border os-hud-line bg-black/30 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
            />
            <button onClick={() => saveMyPost("DRAFT")} disabled={saving} className="btn btn-primary text-xs disabled:opacity-50">
              SAVE DRAFT
            </button>
            <button onClick={() => saveMyPost("POSTED")} disabled={saving} className="rounded-md border border-emerald-400/40 px-3 py-1.5 text-xs font-bold text-emerald-200 hover:bg-emerald-400/10 disabled:opacity-50">
              MARK POSTED
            </button>
          </div>
        )}
        {note && <p className="mt-2 text-xs text-amber-200">{note}</p>}
      </section>

      {kind !== "MYPOST" && extracted && (
        <section className="os-panel p-5">
          <SectionTitle kicker="REVIEW" title="Confirm before creating" />
          <p className="mt-1 text-xs text-zinc-400">
            Blank means not found — fill by hand. Creates a mission as{" "}
            <span className="font-bold text-white">NOT APPLIED</span>; the mission form
            re-checks duplicates before saving.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {(
              [
                ["company", "Company"],
                ["title", "Role / title"],
                ["location", "Location (never guessed)"],
                ["author", kind === "EMAIL" ? "Sender name" : "Author"],
                ["subject", "Email subject (email only)"],
                ["url1", kind === "LINKEDIN" ? "LinkedIn post URL (kept exact)" : "Job URL"],
                ["url2", "Application URL"],
                ["email1", "Email found"],
                ["phone1", "Phone found"],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="flex flex-col gap-1 text-xs text-zinc-400">
                {label}
                <input
                  value={f[k]}
                  onChange={(e) => setF({ ...f, [k]: e.target.value })}
                  className="rounded-lg border os-hud-line bg-black/30 px-3 py-2 text-sm text-white"
                />
              </label>
            ))}
          </div>
          {!(f.company.trim() && f.title.trim()) ? (
            <p className="mt-3 text-xs text-amber-200">
              Company + role are required to continue — add them above.
            </p>
          ) : (
            <Link href={missionHref()} className="btn btn-primary mt-3 inline-block text-xs">
              REVIEW IN MISSION FORM →
            </Link>
          )}
        </section>
      )}
      {kind !== "MYPOST" && !extracted && (
        <EmptyState
          title="PASTE, THEN EXTRACT"
          body="Nothing is created until you review. The mission form stays the single place missions are born — with dedupe and NOT APPLIED enforced."
        />
      )}
    </div>
  );
}
