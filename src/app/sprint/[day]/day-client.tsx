"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LSLOTS, type LSlot, type RoadmapDay } from "@/lib/sprint";

const F =
  "w-full rounded-md border os-hud-line bg-zinc-950 px-2.5 py-1.5 text-sm outline-none focus:border-cyan-400";
const L = "flex flex-col gap-1 text-xs text-zinc-400";

type LcRow = {
  slot: string; title: string; url: string | null; category: string | null;
  difficulty: string | null; status: string; attempts: number; time_minutes: number;
  notes: string | null; approach: string | null; is_review: boolean;
};

export function DayClient(props: {
  runId: number; day: number; date: string; target: number; creates: number;
  initialLc: LcRow[];
  initialProj: Record<string, unknown> | null;
  initialLi: Record<string, unknown> | null;
  initialGh: Record<string, unknown> | null;
  plan: RoadmapDay | null;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const str = (v: unknown) => (v == null ? "" : String(v));

  async function post(url: string, body: object) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ run_id: props.runId, day_number: props.day, ...body }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error ?? "Save failed.");
    return j;
  }

  async function run<T>(fn: () => Promise<T>, okMsg: string) {
    setMsg(null);
    setBusy(true);
    try {
      await fn();
      setMsg("✅ " + okMsg);
      router.refresh();
    } catch (e) {
      setMsg("❌ " + (e instanceof Error ? e.message : "Failed."));
    } finally {
      setBusy(false);
    }
  }

  const lcBySlot = new Map((props.initialLc ?? []).map((r) => [r.slot, r]));
  const proj = props.initialProj ?? {};
  const li = props.initialLi ?? {};
  const gh = props.initialGh ?? {};

  return (
    <div className="flex flex-col gap-5">
      {msg && <p className="text-sm text-zinc-200">{msg}</p>}

      {/* APPS — read-only count from existing records */}
      <section className="os-panel p-4">
        <h3 className="font-bold text-white">Applications — {props.creates}/{props.target} created this day</h3>
        <p className="text-xs text-zinc-500">Counted from your real missions. Never duplicated by the sprint.</p>
      </section>

      {/* LEETCODE — exactly 5 slots */}
      <section className="os-panel p-4">
        <h3 className="font-bold text-white">LeetCode — 5 slots (store the actual problem)</h3>
        <div className="mt-2 flex flex-col gap-3">
          {LSLOTS.map(({ slot, label, hint }) => (
            <SlotForm key={slot} slot={slot} label={label} hint={hint}
              initial={lcBySlot.get(slot)} disabled={busy}
              onSave={(fields) => run(() => post("/api/sprint/leetcode", { slot, ...fields }), `${slot} saved.`)} />
          ))}
        </div>
      </section>

      {/* PROJECT */}
      <section className="os-panel p-4">
        <h3 className="font-bold text-white">
          Mini-project {props.plan ? `— Day ${props.day}: ${props.plan.name}` : ""}
        </h3>
        {props.plan && (
          <p className="text-xs text-zinc-500">{props.plan.category} · try: {props.plan.suggestion} (editable — your call)</p>
        )}
        <SimpleForm
          disabled={busy}
          fields={[
            ["name", str(proj.name) || props.plan?.name || ""],
            ["category", str(proj.category) || props.plan?.category || ""],
            ["problem", str(proj.problem)],
            ["tech", str(proj.tech)],
            ["repo_url", str(proj.repo_url)],
            ["demo_url", str(proj.demo_url)],
            ["lessons", str(proj.lessons)],
          ]}
          select={[["status", str(proj.status) || "PLANNED", ["PLANNED", "IN_PROGRESS", "COMPLETED"]]]}
          checks={[["readme_done", Boolean(proj.readme_done), "README done"]]}
          submitLabel="SAVE PROJECT"
          onSave={(f) => run(() => post("/api/sprint/project", f), "Project saved. COMPLETED only counts when you confirm it.")}
        />
      </section>

      {/* LINKEDIN */}
      <section className="os-panel p-4">
        <h3 className="font-bold text-white">LinkedIn post — manual publishing only</h3>
        <SimpleForm
          disabled={busy}
          fields={[
            ["title", str(li.title)],
            ["body", str(li.body)],
            ["post_url", str(li.post_url)],
            ["project_assoc", str(li.project_assoc)],
            ["engagement", str(li.engagement)],
          ]}
          select={[["status", str(li.status) || "IDEA", ["IDEA", "DRAFTED", "READY", "PUBLISHED", "VERIFIED"]]]}
          submitLabel="SAVE POST"
          onSave={(f) =>
            run(() => post("/api/sprint/linkedin", f), "Post saved. PUBLISHED needs the real URL or explicit confirm.")
          }
        />
        <ConfirmPub initial={str(li.post_url)} disabled={busy}
          onConfirm={(post_url) => run(() => post("/api/sprint/linkedin", { post_url, status: "PUBLISHED", confirmed: true }), "Marked PUBLISHED on your confirm.")} />
      </section>

      {/* GITHUB */}
      <section className="os-panel p-4">
        <h3 className="font-bold text-white">GitHub — one contribution (URL = proof)</h3>
        <SimpleForm
          disabled={busy}
          fields={[
            ["repo", str(gh.repo)],
            ["commit_url", str(gh.commit_url)],
            ["commit_hash", str(gh.commit_hash)],
            ["commit_message", str(gh.commit_message)],
            ["pr_url", str(gh.pr_url)],
          ]}
          select={[["status", str(gh.status) || "PLANNED", ["PLANNED", "COMMITTED", "VERIFIED"]]]}
          submitLabel="SAVE COMMIT"
          onSave={(f) => run(() => post("/api/sprint/github", f), "Commit saved. No URL = no credit.")}
        />
      </section>

      <button
        disabled={busy}
        onClick={() => run(async () => {
          const j = await post("/api/sprint/confirm-day", {});
          setMsg(`✅ Day scored ${j.done}/5 (${j.pct}%). ${j.done === 5 ? "COMPLETED." : "IN_PROGRESS — finish the rest."}`);
        }, "")}
        className="btn btn-primary text-sm disabled:opacity-40"
      >
        {busy ? "Scoring…" : "CONFIRM DAY (score from live rows)"}
      </button>
    </div>
  );
}

function SlotForm({ slot, label, hint, initial, disabled, onSave }: {
  slot: LSlot; label: string; hint: string; initial?: LcRow;
  disabled: boolean; onSave: (f: object) => void;
}) {
  const [open, setOpen] = useState(!initial || initial.status !== "SOLVED");
  const solved = initial?.status === "SOLVED";
  return (
    <div className={`rounded-lg border p-3 ${solved ? "border-emerald-400/40" : "os-hud-line"}`}>
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between text-sm">
        <span className="font-bold text-white">{solved ? "✅" : "⬜"} {slot} · {label}</span>
        <span className="text-xs text-zinc-500">{initial?.title || hint}</span>
      </button>
      {open && (
        <SimpleForm
          disabled={disabled}
          fields={[
            ["title", initial?.title ?? ""],
            ["url", initial?.url ?? ""],
            ["category", initial?.category ?? ""],
            ["difficulty", initial?.difficulty ?? ""],
            ["attempts", String(initial?.attempts ?? 0)],
            ["time_minutes", String(initial?.time_minutes ?? 0)],
            ["approach", initial?.approach ?? ""],
            ["notes", initial?.notes ?? ""],
          ]}
          select={[["status", initial?.status ?? "TODO", ["TODO", "ATTEMPTED", "SOLVED"]]]}
          checks={[["is_review", Boolean(initial?.is_review), "Marked as review"]]}
          submitLabel={`SAVE ${slot}`}
          onSave={onSave}
        />
      )}
    </div>
  );
}

function SimpleForm({ fields, select, checks, submitLabel, onSave, disabled }: {
  fields: [string, string][];
  select?: [string, string, string[]][];
  checks?: [string, boolean, string][];
  submitLabel: string;
  disabled: boolean;
  onSave: (f: Record<string, string | boolean>) => void;
}) {
  const [vals, setVals] = useState<Record<string, string | boolean>>(() => {
    const o: Record<string, string | boolean> = {};
    for (const [k, v] of fields) o[k] = v;
    for (const [k, v] of select ?? []) o[k] = v;
    for (const [k, v] of checks ?? []) o[k] = v;
    return o;
  });
  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      {fields.map(([k]) => (
        <label key={k} className={L}>
          {k.toUpperCase()}
          <textarea rows={k === "notes" || k === "body" || k === "lessons" || k === "approach" ? 3 : 1}
            value={String(vals[k] ?? "")}
            onChange={(e) => setVals((s) => ({ ...s, [k]: e.target.value }))}
            className={`${F} font-mono text-[13px]`} />
        </label>
      ))}
      {(select ?? []).map(([k, , opts]) => (
        <label key={k} className={L}>
          {k.toUpperCase()}
          <select value={String(vals[k] ?? "")} onChange={(e) => setVals((s) => ({ ...s, [k]: e.target.value }))} className={F}>
            {opts.map((o) => <option key={o}>{o}</option>)}
          </select>
        </label>
      ))}
      {(checks ?? []).map(([k, , label]) => (
        <label key={k} className="flex items-center gap-2 text-xs text-zinc-400">
          <input type="checkbox" checked={Boolean(vals[k])} onChange={(e) => setVals((s) => ({ ...s, [k]: e.target.checked }))} />
          {label}
        </label>
      ))}
      <div className="sm:col-span-2">
        <button disabled={disabled} onClick={() => onSave(vals)} className="btn text-xs disabled:opacity-40">
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

function ConfirmPub({ initial, disabled, onConfirm }: {
  initial: string; disabled: boolean; onConfirm: (url: string) => void;
}) {
  const [url, setUrl] = useState(initial);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste real LinkedIn post URL to confirm publishing"
        aria-label="Published post URL" className={`${F} flex-1`} />
      <button disabled={disabled || !url.trim()} onClick={() => onConfirm(url.trim())}
        className="btn text-xs disabled:opacity-40">
        I PUBLISHED IT — CONFIRM
      </button>
    </div>
  );
}
