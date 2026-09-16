"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, Send } from "lucide-react";
import { buildConnectNote, buildWhatsAppOpener, type NoteKind } from "@/lib/connect";

// Per-contact outreach: ≤300-char connect notes (peer/recruiter angles,
// live counter) + WhatsApp opener + manual LOG CONNECT (+5 XP).
export function ConnectNote({
  contactId,
  name,
  role,
  company,
  isPeer,
  phone,
}: {
  contactId: number;
  name: string;
  role: string | null;
  company: string;
  isPeer: boolean;
  // Verified personal mobile only. Post/company lines must NEVER arrive here
  // (stored in notes instead) — no WhatsApp button renders without it.
  phone: string | null;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<NoteKind>(isPeer ? "PEER" : "RECRUITER");
  const [copied, setCopied] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const first = (name.trim().split(" ")[0] || "there").replace(/[^A-Za-z]/g, "") || "there";
  const note = buildConnectNote(kind, first, company || "your company", role ?? "open roles");
  const wa = buildWhatsAppOpener(first, company || "your company", role ?? "open roles");

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* selection fallback */
    }
  }

  async function log() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/connect/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId }),
      });
      const j = await res.json();
      if (j.ok) {
        setMsg(`+5 XP — invite logged (${j.today} today). LinkedIn caps weekly invites: pace, don't burst.`);
        setConfirm(false);
        router.refresh();
      } else {
        setMsg(j.error ?? "Log failed.");
      }
    } catch {
      setMsg("Log failed — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-blue-400/20 bg-blue-400/5 p-3">
      <p className="text-[11px] tracking-widest text-zinc-500">CONNECT NOTE (≤300)</p>
      <div className="mt-1.5 flex gap-1.5" role="group" aria-label="Note angle">
        {(["PEER", "RECRUITER"] as NoteKind[]).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            aria-pressed={kind === k}
            className={`rounded px-2 py-1 text-[11px] font-bold ${
              kind === k ? "bg-blue-400/15 text-blue-200" : "text-zinc-500 hover:text-zinc-200"
            }`}
          >
            {k}
          </button>
        ))}
        <span className={`ml-auto text-[11px] font-bold ${note.length > 300 ? "text-red-300" : "text-zinc-400"}`}>
          {note.length}/300
        </span>
      </div>
      <p className="mt-1.5 rounded bg-black/30 p-2.5 text-xs leading-relaxed text-zinc-100">{note}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          onClick={() => void copy(note, "n")}
          className="inline-flex items-center gap-1.5 rounded-md border border-cyan-400/25 px-2.5 py-1 text-xs font-semibold text-cyan-200 hover:bg-cyan-400/10"
        >
          {copied === "n" ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
          {copied === "n" ? "COPIED" : "COPY NOTE"}
        </button>
        {phone && (
          <button
            onClick={() => void copy(wa, "w")}
            title="Copies opener text only — send manually; use only if this number is on WhatsApp"
            className="inline-flex items-center gap-1.5 rounded-md border border-emerald-400/25 px-2.5 py-1 text-xs font-semibold text-emerald-200 hover:bg-emerald-400/10"
          >
            {copied === "w" ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
            {copied === "w" ? "COPIED" : "COPY WA TEXT"}
          </button>
        )}
        {confirm ? (
          <>
            <span className="self-center text-xs text-zinc-400">Invite sent yourself?</span>
            <button
              onClick={() => void log()}
              disabled={busy}
              className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-bold hover:bg-emerald-500"
            >
              YES, LOG IT
            </button>
            <button onClick={() => setConfirm(false)} className="rounded-md border os-hud-line px-2.5 py-1 text-xs text-zinc-400">
              Not yet
            </button>
          </>
        ) : (
          <button
            onClick={() => setConfirm(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1 text-xs text-zinc-300 hover:bg-white/5"
          >
            <Send size={13} aria-hidden /> LOG CONNECT +5
          </button>
        )}
      </div>
      {msg && (
        <p className="mt-1.5 text-xs text-cyan-200" role="status" aria-live="polite">
          {msg}
        </p>
      )}
    </div>
  );
}
