"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setApplicationStatus } from "@/app/missions/[id]/actions";
import { APP_STATUSES } from "@/lib/game";
import { StatusBadge } from "@/components/ui";
import { checkAchievements, CelebrationHost, type Unlocked } from "@/components/celebration";

const METHODS = ["Company Website", "LinkedIn", "Email", "Referral", "Other"];

export function StatusControl({
  jobId,
  current,
  dateApplied,
  method,
  emailUsed,
  resumeUsed,
  emailOptions,
  resumeOptions,
}: {
  jobId: number;
  current: string;
  dateApplied: string | null;
  method: string | null;
  emailUsed: string | null;
  resumeUsed: string | null;
  emailOptions: string[];
  resumeOptions: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState(current);
  const [date, setDate] = useState(
    dateApplied ?? new Date().toISOString().slice(0, 10),
  );
  const [methodV, setMethodV] = useState(method ?? "Company Website");
  const [emailV, setEmailV] = useState(emailUsed ?? "");
  const [resumeV, setResumeV] = useState(resumeUsed ?? "");
  const [confirming, setConfirming] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [reward, setReward] = useState<number | null>(null);
  const [queue, setQueue] = useState<Unlocked[]>([]);

  const needsConfirm = status === "APPLIED" && current !== "APPLIED" && !confirming;

  function submit(confirmed: boolean) {
    setErr(null);
    setReward(null);
    start(async () => {
      try {
        const res = await setApplicationStatus({
          jobId,
          status: status as (typeof APP_STATUSES)[number],
          date,
          method: methodV,
          emailUsed: emailV || null,
          resumeUsed: resumeV || null,
          confirmedApplied: confirmed,
        });
        if (res.xpAwarded > 0) setReward(res.xpAwarded);
        setConfirming(false);
        setQueue(await checkAchievements());
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Save failed.");
      }
    });
  }

  const F =
    "rounded-md border os-hud-line bg-zinc-950 px-2.5 py-1.5 text-sm outline-none focus:border-cyan-400";

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs tracking-widest text-zinc-500">APPLICATION STATUS</span>
        <StatusBadge status={current} />
      </div>
      {current === "APPLIED" && (
        <div className="grid gap-1 text-xs text-zinc-400 sm:grid-cols-2">
          <span>
            APPLIED: <strong className="text-zinc-100">{dateApplied ?? "—"}</strong>
          </span>
          <span>
            METHOD: <strong className="text-zinc-100">{method ?? "—"}</strong>
          </span>
          <span className="break-all">
            EMAIL USED: <strong className="text-zinc-100">{emailUsed ?? "Not specified"}</strong>
          </span>
          <span className="break-all">
            RESUME USED: <strong className="text-zinc-100">{resumeUsed ?? "Not specified"}</strong>
          </span>
        </div>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          STATUS
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setConfirming(false); }}
            className={F}
          >
            {APP_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        {status === "APPLIED" && (
          <>
            <label className="flex flex-col gap-1 text-xs text-zinc-400">
              DATE APPLIED
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={F}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-400">
              METHOD
              <select value={methodV} onChange={(e) => setMethodV(e.target.value)} className={F}>
                {METHODS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-400">
              EMAIL USED
              <select value={emailV} onChange={(e) => setEmailV(e.target.value)} className={F}>
                <option value="">Not specified</option>
                {emailOptions.map((e) => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-400">
              RESUME USED
              <select value={resumeV} onChange={(e) => setResumeV(e.target.value)} className={F}>
                <option value="">Not specified</option>
                {resumeOptions.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </label>
          </>
        )}
        {!confirming ? (
          <button
            onClick={() => (needsConfirm ? setConfirming(true) : submit(false))}
            disabled={pending || (status === current && status !== "APPLIED")}
            className="btn btn-primary text-xs disabled:opacity-40"
          >
            {pending ? "Saving…" : status === "APPLIED" && current !== "APPLIED" ? "MARK AS APPLIED" : "SAVE STATUS"}
          </button>
        ) : (
          <div className="flex flex-col gap-2 rounded-lg border border-amber-400/50 bg-amber-400/5 p-3 text-sm">
            <p className="font-bold text-white">CONFIRM APPLICATION</p>
            <p className="text-zinc-300">Have you actually submitted this application?</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirming(false)} className="btn btn-ghost text-xs">
                CANCEL
              </button>
              <button onClick={() => submit(true)} disabled={pending} className="btn btn-success text-xs disabled:opacity-40">
                {pending ? "Saving…" : "YES, I APPLIED"}
              </button>
            </div>
          </div>
        )}
      </div>
      {err && <p className="text-xs text-red-300">{err}</p>}
      <CelebrationHost queue={queue} onDone={() => { setQueue([]); router.refresh(); }} />
      {reward !== null && reward > 0 && (
        <p className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-sm font-bold text-emerald-200" aria-live="polite">
          ⚔ OBJECTIVE COMPLETE · +{reward} XP — HUD and sidebar updated.
        </p>
      )}
    </div>
  );
}
