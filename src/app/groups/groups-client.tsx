"use client";

import { useState } from "react";
import Link from "next/link";
import { SectionTitle, EmptyState } from "@/components/ui";

export type GroupPost = {
  id: number;
  platform: "WHATSAPP" | "TELEGRAM";
  group_name: string;
  sender_name: string | null;
  body: string;
  status: "NEW" | "VISITED" | "INGESTED";
  mission_job_id: number | null;
  created_at: string;
};

const TABS = [
  { key: "TELEGRAM", label: "TELEGRAM" },
  { key: "WHATSAPP", label: "WHATSAPP" },
] as const;

function day(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase();
}

export function GroupsClient({
  initial,
  setupNeeded,
}: {
  initial: GroupPost[];
  setupNeeded: boolean;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("TELEGRAM");
  const [posts, setPosts] = useState<GroupPost[]>(initial);
  const [groupName, setGroupName] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  if (setupNeeded) {
    return (
      <section className="os-panel p-5">
        <SectionTitle kicker="SETUP" title="One-time database step" />
        <p className="mt-2 text-sm text-zinc-300">
          The groups inbox needs its table. In Supabase Dashboard → SQL Editor,
          paste and run <span className="font-mono">supabase/migration_014.sql</span> once,
          then reload this page.
        </p>
      </section>
    );
  }

  const shown = posts.filter((p) => p.platform === tab);
  const fresh = shown.filter((p) => p.status === "NEW").length;

  async function capture() {
    if (!groupName.trim() || !body.trim()) {
      setNote("Group name + post text are both required.");
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/groups/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: tab, group_name: groupName.trim(), body: body.trim() }),
      });
      const j = await res.json();
      if (res.status === 409 && j.duplicate) {
        setNote(`Already visited — this exact post is already in your inbox (${j.status}).`);
        return;
      }
      if (!res.ok) {
        setNote("Could not save. Try again.");
        return;
      }
      const list = await fetch("/api/groups/ingest?platform=ALL").then((r) => r.json());
      setPosts((list.posts ?? []) as GroupPost[]);
      setBody("");
      setNote("Captured. Newest posts stay on top.");
    } catch {
      setNote("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function mark(id: number, status: "VISITED" | "INGESTED") {
    const res = await fetch("/api/groups/visit", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
  }

  function missionLink(p: GroupPost) {
    const qs = new URLSearchParams({
      description: p.body.slice(0, 8000),
      source: `${p.platform === "TELEGRAM" ? "Telegram" : "WhatsApp"} group: ${p.group_name}`,
      source_type: p.platform === "TELEGRAM" ? "TELEGRAM_GROUP" : "WHATSAPP_GROUP",
    });
    return `/missions/new?${qs.toString()}`;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" aria-label="Platform tabs">
        {TABS.map((t) => {
          const n = posts.filter((p) => p.platform === t.key && p.status === "NEW").length;
          return (
            <button
              key={t.key}
              aria-pressed={tab === t.key}
              onClick={() => {
                setTab(t.key);
                setNote(null);
              }}
              className={`rounded-full border px-3 py-1 text-xs font-semibold tracking-wider ${
                tab === t.key
                  ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-200"
                  : "os-hud-line text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {t.label} {n > 0 ? `(${n} NEW)` : ""}
            </button>
          );
        })}
      </div>

      <section className="os-panel p-5">
        <SectionTitle kicker="INTAKE" title={`Forward a ${tab === "TELEGRAM" ? "Telegram" : "WhatsApp"} post`} />
        <p className="mt-1 text-xs text-zinc-400">
          Copy the post text from the group, paste it here. Exact reposts are caught —
          “already visited”, never stored twice.
        </p>
        <input
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder="Group name (e.g. Fresher Jobs Pune)"
          className="mt-3 w-full rounded-lg border os-hud-line bg-black/30 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Paste the full job post text…"
          rows={4}
          className="mt-2 w-full rounded-lg border os-hud-line bg-black/30 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
        />
        <button
          onClick={capture}
          disabled={busy}
          className="btn btn-primary mt-2 text-xs disabled:opacity-50"
        >
          {busy ? "CAPTURING…" : "CAPTURE POST"}
        </button>
        {note && <p className="mt-2 text-xs text-amber-200">{note}</p>}
      </section>

      {shown.length === 0 ? (
        <EmptyState
          title={`NO ${tab} POSTS YET`}
          body="Forwarded posts land here, newest first. Paste the first one above."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((p) => (
            <li key={p.id} className="os-panel p-4">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold tracking-widest">
                <span className="text-cyan-300">{p.group_name}</span>
                <span className="text-zinc-500">· {day(p.created_at)}</span>
                <span
                  className={`rounded-full border px-2 py-0.5 ${
                    p.status === "NEW"
                      ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                      : p.status === "INGESTED"
                        ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-200"
                        : "border-zinc-500/40 text-zinc-400"
                  }`}
                >
                  {p.status}
                </span>
              </div>
              {p.sender_name && (
                <p className="mt-1 text-xs text-zinc-500">via {p.sender_name}</p>
              )}
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
                {p.body.length > 600 ? `${p.body.slice(0, 600)}…` : p.body}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={missionLink(p)} className="btn btn-primary text-xs">
                  SEND TO MISSIONS →
                </Link>
                {p.status === "NEW" && (
                  <button
                    onClick={() => mark(p.id, "VISITED")}
                    className="rounded-md border os-hud-line px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:text-white"
                  >
                    MARK VISITED
                  </button>
                )}
                {p.status !== "INGESTED" && (
                  <button
                    onClick={() => mark(p.id, "INGESTED")}
                    className="rounded-md border border-cyan-400/25 px-3 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-400/10"
                  >
                    MARK INGESTED
                  </button>
                )}
                {p.mission_job_id && (
                  <Link
                    href={`/missions/${p.mission_job_id}`}
                    className="rounded-md border os-hud-line px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:text-white"
                  >
                    OPEN MISSION
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {fresh > 0 && (
        <p className="text-xs text-zinc-500">
          {fresh} unvisited {tab === "TELEGRAM" ? "Telegram" : "WhatsApp"} post{tab === "TELEGRAM" ? "s" : "s"} waiting.
        </p>
      )}
    </div>
  );
}
