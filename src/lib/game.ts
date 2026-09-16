// Central game rules: levels, XP, difficulty, progress, next actions.
// All computed from REAL database rows — never hardcoded demo values.

export type Level = { n: number; title: string; minXp: number };

export const LEVELS: Level[] = [
  { n: 1, title: "Recruit", minXp: 0 },
  { n: 2, title: "Candidate", minXp: 101 },
  { n: 3, title: "Applicant", minXp: 251 },
  { n: 4, title: "Interview Ready", minXp: 501 },
  { n: 5, title: "Technical Challenger", minXp: 1001 },
  { n: 6, title: "Job Hunter", minXp: 2001 },
  { n: 7, title: "Career Builder", minXp: 3501 },
  { n: 8, title: "Specialist", minXp: 5001 },
  { n: 9, title: "Elite Candidate", minXp: 8000 },
  { n: 10, title: "Career Breakthrough", minXp: 12000 },
];

export function levelFor(xp: number) {
  let cur = LEVELS[0];
  let next: Level | null = null;
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i].minXp) cur = LEVELS[i];
    else {
      next = LEVELS[i];
      break;
    }
  }
  return { cur, next };
}

export type Difficulty = "EASY" | "NORMAL" | "HARD" | "ELITE";

export function difficultyFor(priority: string | null, quality: number | null): Difficulty {
  if ((priority ?? "").toLowerCase() === "high" && (quality ?? 0) >= 85) return "ELITE";
  if ((priority ?? "").toLowerCase() === "high") return "HARD";
  if ((priority ?? "").toLowerCase() === "low") return "EASY";
  return "NORMAL";
}

export const DIFF_STARS: Record<Difficulty, number> = {
  EASY: 1,
  NORMAL: 2,
  HARD: 3,
  ELITE: 4,
};

export type Objective = { key: string; label: string; done: boolean };

export function objectivesFor(m: {
  description?: string | null;
  resumeCount: number;
  draftCount: number;
  stage: string | null;
  prepDone: boolean;
}): { objectives: Objective[]; progress: number } {
  const objectives: Objective[] = [
    { key: "intel", label: "Analyze JD", done: Boolean(m.description) },
    { key: "resume", label: "Tailor resume", done: m.resumeCount > 0 },
    { key: "outreach", label: "Draft outreach", done: m.draftCount > 0 },
    {
      key: "applied",
      label: "Submit application",
      done: ["APPLIED", "OUTREACH", "WAITING", "ASSESSMENT", "INTERVIEW", "OFFER"].includes(
        (m.stage ?? "").toUpperCase(),
      ),
    },
    { key: "prep", label: "Interview prep", done: m.prepDone },
  ];
  const done = objectives.filter((o) => o.done).length;
  return { objectives, progress: Math.round((done / objectives.length) * 100) };
}

export function nextActionFor(m: {
  description?: string | null;
  resumeCount: number;
  draftCount: number;
  stage: string | null;
  prepDone: boolean;
}): string {
  if (!m.description) return "Capture the job intel (JD)";
  if (m.resumeCount === 0) return "Tailor resume";
  if (m.draftCount === 0 && !/applied|outreach|waiting/i.test(m.stage ?? ""))
    return "Draft outreach";
  if (/resume ready|ready to apply/i.test(m.stage ?? "") || !(m.stage ?? "").match(/applied|outreach|waiting|interview|offer/i))
    return "Send application";
  if (!m.prepDone) return "Prepare interview";
  return "Follow up";
}

export const APP_STATUSES = [
  "NOT APPLIED",
  "SHORTLISTED",
  "PREPARING",
  "READY TO APPLY",
  "APPLIED",
  "RECRUITER CONTACTED",
  "RECRUITER RESPONDED",
  "SCREENING",
  "ASSESSMENT",
  "INTERVIEW SCHEDULED",
  "INTERVIEW COMPLETED",
  "FINAL ROUND",
  "OFFER",
  "REJECTED",
  "WITHDRAWN",
  "ON HOLD",
  "CLOSED",
] as const;

export const STAGE_ORDER = [  "NOT APPLIED",
  "SHORTLISTED",
  "PREPARING",
  "READY TO APPLY",
  "APPLIED",
  "SCREENING",
  "ASSESSMENT",
  "INTERVIEW",
  "OFFER",
];

// Preparation-side stages (need action) vs terminal/engaged stages.
// Application status is user-controlled; this only drives board grouping.
const ENGAGED = new Set([
  "APPLIED", "OUTREACH", "WAITING", "RECRUITER CONTACTED", "RECRUITER RESPONDED",
  "SCREENING", "ASSESSMENT", "INTERVIEW", "INTERVIEW SCHEDULED",
  "INTERVIEW COMPLETED", "FINAL ROUND", "OFFER", "REJECTED", "WITHDRAWN", "CLOSED",
]);

export function isActiveStage(stage: string | null) {
  return !ENGAGED.has((stage ?? "NOT APPLIED").toUpperCase());
}

export function stageIndex(stage: string | null) {
  const i = STAGE_ORDER.indexOf((stage ?? "DISCOVERED").toUpperCase());
  return i < 0 ? 0 : i;
}

// ---------- Semantic color system (single source of truth) ----------
export const STATUS_COLORS: Record<string, string> = {
  "NOT APPLIED": "border-sky-400/40 bg-sky-400/10 text-sky-200",
  PREPARING: "border-violet-400/40 bg-violet-400/10 text-violet-200",
  "RESUME READY": "border-violet-400/40 bg-violet-400/10 text-violet-200",
  "READY TO APPLY": "border-cyan-400/50 bg-cyan-400/10 text-cyan-200",
  APPLIED: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
  OUTREACH: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
  WAITING: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
  SCREENING: "border-blue-400/40 bg-blue-400/10 text-blue-200",
  ASSESSMENT: "border-orange-400/40 bg-orange-400/10 text-orange-200",
  INTERVIEW: "border-fuchsia-400/50 bg-fuchsia-400/10 text-fuchsia-200",
  "FINAL ROUND": "border-fuchsia-400/50 bg-fuchsia-400/10 text-fuchsia-200",
  OFFER: "border-yellow-300/50 bg-yellow-300/10 text-yellow-200",
  REJECTED: "border-red-400/50 bg-red-400/10 text-red-200",
  WITHDRAWN: "border-zinc-500/50 bg-zinc-500/10 text-zinc-300",
  "ON HOLD": "border-orange-300/40 bg-orange-300/10 text-orange-200",
  CLOSED: "border-zinc-600 bg-zinc-800 text-zinc-400",
};
export const statusColor = (s: string | null) =>
  STATUS_COLORS[(s ?? "NOT APPLIED").toUpperCase()] ??
  "os-hud-line text-zinc-300";

export const DIFF_THEME: Record<Difficulty, { edge: string; badge: string; bar: string }> = {
  EASY: {
    edge: "border-t-2 border-t-sky-400/70",
    badge: "border-sky-400/40 bg-sky-400/10 text-sky-200",
    bar: "grad-prep",
  },
  NORMAL: {
    edge: "border-t-2 border-t-cyan-400/70",
    badge: "border-cyan-400/40 bg-cyan-400/10 text-cyan-200",
    bar: "grad-prep",
  },
  HARD: {
    edge: "border-t-2 border-t-orange-400/80",
    badge: "border-orange-400/50 bg-orange-400/10 text-orange-200",
    bar: "grad-warn",
  },
  ELITE: {
    edge: "border-t-2 border-t-fuchsia-400/80 shadow-[0_0_28px_rgba(232,72,153,0.15)]",
    badge: "border-fuchsia-400/50 bg-fuchsia-400/10 text-fuchsia-200",
    bar: "grad-elite",
  },
};

export const SOURCE_COLORS: Record<string, string> = {
  LINKEDIN_POST: "border-blue-400/40 bg-blue-400/10 text-blue-200",
  PORTAL: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
  EMAIL: "border-violet-400/40 bg-violet-400/10 text-violet-200",
};

export const DOC_COLORS: Record<string, { text: string; chip: string }> = {
  RESUME: { text: "text-cyan-300", chip: "border-cyan-400/40 bg-cyan-400/10 text-cyan-200" },
  INTERVIEW: { text: "text-violet-300", chip: "border-violet-400/40 bg-violet-400/10 text-violet-200" },
  SCREENSHOT: { text: "text-pink-300", chip: "border-pink-400/40 bg-pink-400/10 text-pink-200" },
  RESEARCH: { text: "text-emerald-300", chip: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200" },
  EMAIL: { text: "text-yellow-200", chip: "border-yellow-300/40 bg-yellow-300/10 text-yellow-200" },
};
export function docColor(t: string) {
  if (t.includes("RESUME")) return DOC_COLORS.RESUME;
  if (t.includes("INTERVIEW")) return DOC_COLORS.INTERVIEW;
  if (t.includes("SCREENSHOT") || t.includes("IMAGE")) return DOC_COLORS.SCREENSHOT;
  if (t.includes("RESEARCH")) return DOC_COLORS.RESEARCH;
  if (t.includes("EMAIL")) return DOC_COLORS.EMAIL;
  return { text: "text-zinc-300", chip: "os-hud-line text-zinc-300" };
}

export const CONTACT_TYPE_COLORS: Record<string, string> = {
  RECRUITER: "border-violet-400/40 bg-violet-400/10 text-violet-200",
  HR: "border-pink-400/40 bg-pink-400/10 text-pink-200",
  "HIRING MANAGER": "border-blue-400/40 bg-blue-400/10 text-blue-200",
  REFERRAL: "border-yellow-300/40 bg-yellow-300/10 text-yellow-200",
  EMPLOYEE: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
};
