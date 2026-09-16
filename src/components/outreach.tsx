"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, ExternalLink, Send, MessageCircle, Globe } from "lucide-react";
import { SectionTitle } from "@/components/ui";
import { waDefaultFor } from "@/lib/outreach-copy";

export type OutreachEmail = { address: string };
export type OutreachResume = { file: string };
export type WaContact = { id: number; name: string; phone: string; source: string | null };
export type LiNote = { id: number; body: string; status: string };

function waLink(phone: string, text: string) {
  const digits = phone.replace(/\D/g, "");
  const intl = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
}

export function OutreachSection({
  jobId,
  company,
  role,
  requiredSkills,
  location,
  emails,
  resumes,
  latestDraft,
  gmailConnected,
  gmailAddress,
  waContacts,
  liNotes,
  postUrl,
}: {
  jobId: number;
  company: string;
  role: string;
  requiredSkills: string | null;
  location: string | null;
  emails: OutreachEmail[];
  resumes: OutreachResume[];
  latestDraft: { to: string; subject: string; body: string } | null;
  gmailConnected: boolean;
  gmailAddress: string | null;
  waContacts: WaContact[];
  liNotes: LiNote[];
  postUrl: string | null;
}) {
  const router = useRouter();
  const [to, setTo] = useState(latestDraft?.to ?? emails[0]?.address ?? "");
  const [resume, setResume] = useState(resumes[0]?.file ?? "");
  const [subject, setSubject] = useState(latestDraft?.subject ?? `Application for ${role} – Anant Prabhudesai | MCA 2026 Fresher`);
  const [body, setBody] = useState(latestDraft?.body ?? "");
  const [confirmSend, setConfirmSend] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [waText, setWaText] = useState<Record<number, string>>({});
  const [waMsg, setWaMsg] = useState<string | null>(null);

  const resumeOk = resumes.some((r) => r.file === resume);
  const F = "w-full rounded-md border os-hud-line bg-zinc-950 px-2.5 py-1.5 text-sm outline-none focus:border-cyan-400";

  function copy(key: string, text: string) {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    }).catch(() => alert("Copy failed."));
  }
  async function log(payload: Record<string, unknown>) {
    await fetch("/api/outreach/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, ...payload }),
    });
    router.refresh();
  }
  async function sendEmail() {
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId, to, subject, body, resumeFileName: resume, confirmed: true,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Send failed.");
      setResult(`✓ SENT via Gmail · message ${j.messageId}`);
      setConfirmSend(false);
      router.refresh();
    } catch (e) {
      setResult(e instanceof Error ? `FAILED: ${e.message}` : "Send failed.");
    } finally {
      setSending(false);
    }
  }

  const waDefault = (name: string) =>
    waDefaultFor({
      first: name.split(" ")[0] || "there",
      role,
      company,
      requiredSkills,
      location,
    });

  return (
    <div className="flex flex-col gap-5">
      {/* EMAIL */}
      <section className="os-panel border-cyan-400/20 p-5">
        <SectionTitle kicker="OUTREACH" title="Email — approval send" />
        {!gmailConnected ? (
          <div className="text-sm">
            <p className="text-zinc-300">
              Gmail is not connected. Connect once via Google (OAuth — no password shared), then
              send from here after review.
            </p>
            <a href="/api/gmail/connect" className="btn btn-primary mt-2 text-xs">
              CONNECT GMAIL
            </a>
          </div>
        ) : (
          <div className="flex flex-col gap-2 text-sm">
            <p className="text-xs text-zinc-400">
              FROM: <strong className="text-zinc-100">{gmailAddress ?? "connected account"}</strong>
              {resumes.length > 0 && (
                <> · ATTACHMENT: <strong className="text-zinc-100">{resume || "—"}</strong></>
              )}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-zinc-400">TO
                <select value={to} onChange={(e) => setTo(e.target.value)} className={F}>
                  {emails.map((e) => <option key={e.address} value={e.address}>{e.address}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-400">RESUME (must match this job)
                <select value={resume} onChange={(e) => setResume(e.target.value)} className={F}>
                  {resumes.map((r) => <option key={r.file} value={r.file}>{r.file}</option>)}
                </select>
              </label>
            </div>
            {!resumeOk && (
              <p className="rounded border border-red-400/50 bg-red-400/10 p-2 text-xs font-bold text-red-200">
                BLOCKED: selected resume does not belong to this application.
              </p>
            )}
            <label className="flex flex-col gap-1 text-xs text-zinc-400">SUBJECT
              <input value={subject} onChange={(e) => setSubject(e.target.value)} className={F} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-400">BODY (review / edit)
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} className={`${F} font-mono text-[13px]`} />
            </label>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => copy("mail-subject", subject)} className="btn btn-ghost text-xs">
                {copied === "mail-subject" ? "✓ COPIED" : "COPY SUBJECT"}
              </button>
              <button onClick={() => copy("mail-body", body)} className="btn btn-ghost text-xs">
                {copied === "mail-body" ? "✓ COPIED" : "COPY MAIL"}
              </button>
              {to && (
                <button onClick={() => copy("mail-to", to)} className="btn btn-ghost text-xs">
                  {copied === "mail-to" ? "✓ COPIED" : "COPY EMAIL"}
                </button>
              )}
            </div>
            {!confirmSend ? (
              <button onClick={() => setConfirmSend(true)} disabled={!to || !resumeOk} className="btn btn-primary self-start text-xs disabled:opacity-40">
                <Send size={13} aria-hidden /> SEND EMAIL
              </button>
            ) : (
              <div className="rounded-lg border border-amber-400/50 bg-amber-400/5 p-3">
                <p className="font-bold text-white">CONFIRM SEND</p>
                <p className="text-xs text-zinc-300">To {to} · attach {resume} · via Gmail. Send now?</p>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => setConfirmSend(false)} className="btn btn-ghost text-xs">CANCEL</button>
                  <button onClick={sendEmail} disabled={sending} className="btn btn-success text-xs disabled:opacity-40">
                    {sending ? "SENDING…" : "YES, SEND EMAIL"}
                  </button>
                </div>
              </div>
            )}
            {result && <p className="text-xs font-bold text-emerald-200">{result}</p>}
          </div>
        )}
      </section>

      {/* WHATSAPP (manual only) */}
      <section className="os-panel border-emerald-400/20 p-5">
        <SectionTitle kicker="OUTREACH" title="Personal WhatsApp — you send" />
        {waContacts.length === 0 ? (
          <p className="text-sm text-zinc-400">No phone numbers on file for this mission.</p>
        ) : (
          waContacts.map((c) => {
            const text = waText[c.id] ?? waDefault(c.name);
            return (
              <div key={c.id} className="mb-3 rounded-lg border os-hud-line p-3">
                <p className="text-sm font-bold text-white">
                  {c.name} · <span className="font-mono">{c.phone}</span>
                </p>
                {c.source && <p className="text-xs text-zinc-500">Source: {c.source}</p>}
                <textarea
                  value={text}
                  onChange={(e) => setWaText({ ...waText, [c.id]: e.target.value })}
                  rows={4}
                  aria-label={`WhatsApp message for ${c.name}`}
                  className={`${F} mt-2 font-mono text-[13px]`}
                />
                {resumes[0] && (
                  <p className="mt-1 text-xs text-zinc-400">
                    ATTACH MANUALLY: <strong className="text-zinc-200">{resumes[0].file}</strong> (photo resume — system never sends files for you)
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  <button onClick={() => { copy(`wa-${c.id}`, text); void log({ channel: "WHATSAPP", action: "WA_OPENED", contactId: c.id, body: text }); setWaMsg("Message copied — paste it in WhatsApp after opening."); }} className="btn btn-ghost text-xs">
                    <Copy size={12} aria-hidden /> {copied === `wa-${c.id}` ? "✓ COPIED" : "COPY MESSAGE"}
                  </button>
                  <button onClick={() => copy(`wan-${c.id}`, c.phone.replace(/\D/g, ""))} className="btn btn-ghost text-xs">
                    {copied === `wan-${c.id}` ? "✓ COPIED" : "COPY NUMBER"}
                  </button>
                  <a href={waLink(c.phone, text)} target="_blank" rel="noreferrer"
                    onClick={() => { void log({ channel: "WHATSAPP", action: "WA_OPENED", contactId: c.id }); }}
                    className="btn btn-success text-xs">
                    <MessageCircle size={12} aria-hidden /> OPEN WHATSAPP
                  </a>
                  <button onClick={() => { void log({ channel: "WHATSAPP", action: "WA_SENT_MANUAL", contactId: c.id }).then(() => { setWaMsg("Marked SENT MANUALLY."); router.refresh(); }); }} className="btn btn-ghost text-xs">
                    I SENT IT ✓
                  </button>
                </div>
              </div>
            );
          })
        )}
        {waMsg && <p className="text-xs text-emerald-200">{waMsg}</p>}
      </section>

      {/* LINKEDIN (manual only) */}
      <section className="os-panel border-blue-400/20 p-5">
        <SectionTitle kicker="OUTREACH" title="LinkedIn — ≤300 chars, you send" />
        {liNotes.length === 0 ? (
          <p className="text-sm text-zinc-400">No connection notes drafted for this mission yet.</p>
        ) : (
          liNotes.map((n) => (
            <LiNote key={n.id} jobId={jobId} note={n} postUrl={postUrl} copy={copy} copied={copied} log={log} />
          ))
        )}
      </section>
    </div>
  );
}

function LiNote({ jobId, note, postUrl, copy, copied, log }: {
  jobId: number;
  note: { id: number; body: string; status: string };
  postUrl: string | null;
  copy: (k: string, t: string) => void;
  copied: string | null;
  log: (p: Record<string, unknown>) => Promise<void>;
}) {
  const over = note.body.length > 300;
  return (
    <div className="mb-3 rounded-lg border os-hud-line p-3">
      <div className="flex items-center gap-2 text-sm">
        <Globe size={14} className="text-blue-300" aria-hidden />
        <span className={`ml-auto font-mono text-xs ${over ? "font-bold text-red-300" : "text-zinc-400"}`}>
          {note.body.length} / 300
        </span>
      </div>
      <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-zinc-100">{note.body}</p>
      <p className="mt-1 text-xs text-zinc-500">Status: {note.status}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button onClick={() => { copy(`li-${note.id}`, note.body); void log({ channel: "LINKEDIN", action: "LI_COPIED" }); }} className="btn btn-ghost text-xs">
          {copied === `li-${note.id}` ? "✓ COPIED" : "COPY NOTE"}
        </button>
        {postUrl && (
          <a href={postUrl} target="_blank" rel="noreferrer"
            onClick={() => { void log({ channel: "LINKEDIN", action: "LI_OPENED" }); }}
            className="btn btn-ghost text-xs">
            <ExternalLink size={12} aria-hidden /> OPEN POST
          </a>
        )}
      </div>
      {over && <p className="mt-1 text-xs text-red-300">Over 300 characters — shorten before sending.</p>}
    </div>
  );
}
