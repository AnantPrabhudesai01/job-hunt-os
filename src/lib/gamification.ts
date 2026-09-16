// Gamification rules: seasons, daily bounties, combo meter, loadout rarity,
// personal records. CLIENT-SAFE (pure, zero imports) — same pattern as
// achievements-data. All progress derives from REAL rows; nothing is
// punitive — missed days simply don't award, never subtract.

export type BountyKey = "first-move" | "fresh-intel" | "battle-ready";

export type BountyDef = {
  key: BountyKey;
  title: string;
  desc: string;
  xp: number;
};

export const BOUNTIES: BountyDef[] = [
  {
    key: "first-move",
    title: "First Move",
    desc: "Log any hunt action today — new intel, resume, draft, prep, or event.",
    xp: 15,
  },
  {
    key: "fresh-intel",
    title: "Fresh Intel",
    desc: "Bring in 1+ new missions today.",
    xp: 20,
  },
  {
    key: "battle-ready",
    title: "Battle Ready",
    desc: "Ship 1+ interview preps or mark 1+ applications APPLIED today.",
    xp: 25,
  },
];

export const bountyId = (day: string, key: BountyKey) => `bounty-${day}-${key}`;

/** UTC day bucket (matches created_at slicing used by streak stats). */
export const todayKey = (d = new Date()) => d.toISOString().slice(0, 10);

/** Combo multiplier from consecutive pre-today full-clear days. Positive-only. */
export function comboFor(clearDays: string[], today: string): { mult: number; streak: number } {
  const set = new Set(clearDays.filter((d) => d < today));
  let streak = 0;
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  while (set.has(d.toISOString().slice(0, 10))) {
    streak++;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return { mult: Math.min(2, 1 + streak * 0.25), streak };
}

export const comboBonus = (base: number, mult: number) => Math.round(base * mult);

// ---------- Seasons (calendar months, themed focus) ----------
const SEASON_FOCUS = [
  "New Year Offensive", "Deep Winter Grind", "Spring Push", "April Advance",
  "May Momentum", "Midyear Siege", "Monsoon Hustle", "August Assault",
  "September Surge", "October Offensive", "November Push", "December Drive",
];

export function seasonFor(d = new Date()) {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const names = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return {
    id: `${y}-${String(m + 1).padStart(2, "0")}`,
    title: `${names[m]} ${y} — ${SEASON_FOCUS[m]}`,
  };
}

// ---------- Loadout rarity (match-depth estimate, heuristic + labeled) ----------
export type LoadoutRarity = "EPIC" | "RARE";

export function rarityForResume(fileName: string): { tier: LoadoutRarity; why: string } {
  if (/general/i.test(fileName))
    return { tier: "RARE", why: "General template — broad fit" };
  return { tier: "EPIC", why: "Role-tailored — deep match" };
}

export const RARITY_STYLE: Record<LoadoutRarity, string> = {
  EPIC: "border-fuchsia-400/50 bg-fuchsia-400/10 text-fuchsia-200",
  RARE: "border-sky-400/40 bg-sky-400/10 text-sky-200",
};

// ---------- Daily / weekly / monthly application targets ----------
export const TARGETS = { daily: 100, weekly: 700, monthly: 3000 };

// APPLIED-stage flips only (manual MARK AS APPLIED clicks — mail-originated
// missions count the same once YOU flip them). Sends/drafts never count.
export const MILESTONES = [
  { at: 25, xp: 25 },
  { at: 50, xp: 50 },
  { at: 75, xp: 100 },
  { at: 100, xp: 200 },
];

export const milestoneId = (day: string, at: number) => `target-${day}-m${at}`;

/** Monday (UTC) starting the week containing day. */
export function weekStart(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

export const monthStart = (day: string) => day.slice(0, 7) + "-01";
// ---------- Penalties (user-ordered 2026-09-09 — the teeth) ----------
// A mission counts as APPLIED only via your manual MARK AS APPLIED flip.
// Shares, drafts and sends never stop the clock.
export const PENALTIES = {
  stale24h: -5, // unapplied 24h after intake
  stale72h: -10, // still unapplied after 72h (extra, one-time)
  dailyMiss: -50, // day closes below the 100 target
};

// Stages where the clock runs (not yet applied, not terminally closed).
const PRE_APPLIED = new Set([
  "NOT APPLIED", "DISCOVERED", "ANALYZING", "SHORTLISTED", "PREPARING",
  "RESUME READY", "READY TO APPLY",
]);

export const clockRuns = (stage: string | null) =>
  PRE_APPLIED.has((stage ?? "NOT APPLIED").toUpperCase());

/** One-time fees owed for a mission of the given age (hours). */
export function feesFor(ageHours: number): ("24h" | "72h")[] {
  const out: ("24h" | "72h")[] = [];
  if (ageHours >= 24) out.push("24h");
  if (ageHours >= 72) out.push("72h");
  return out;
}

export const FEE_XP = { "24h": PENALTIES.stale24h, "72h": PENALTIES.stale72h } as const;

export const penaltyAction = (mission: string, window: "24h" | "72h") =>
  `Penalty: ${mission} unapplied ${window}`;

export const missAction = (day: string) => `Penalty: missed target ${day}`;
// ---------- Skill match (heuristic, labeled — JD terms vs verified stack) ----------
const MATCH_STACK: [string, string[]][] = [
  ["javascript", ["javascript", "js", "es6", "ecmascript"]],
  ["react", ["react"]],
  ["next.js", ["next"]],
  ["node.js", ["node"]],
  ["express", ["express"]],
  ["python", ["python"]],
  ["java", ["java"]],
  ["sql", ["sql"]],
  ["mysql", ["mysql"]],
  ["mongodb", ["mongo"]],
  ["rest", ["rest", "api"]],
  ["git", ["git"]],
  ["html", ["html"]],
  ["css", ["css"]],
  ["tailwind", ["tailwind"]],
  ["agile", ["agile", "scrum"]],
  ["json", ["json"]],
];

export function matchScoreFor(requiredSkills: string | null): { pct: number; hits: number; total: number } | null {
  if (!requiredSkills?.trim()) return null;
  const terms = requiredSkills
    .split(/[,;|•\n/]+/)
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 1);
  if (terms.length === 0) return null;
  let hits = 0;
  for (const term of terms) {
    if (MATCH_STACK.some(([, aliases]) => aliases.some((a) => term.includes(a)))) hits++;
  }
  return { pct: Math.round((hits / terms.length) * 100), hits, total: terms.length };
}

export const matchTone = (pct: number) =>
  pct >= 70
    ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
    : pct >= 40
      ? "border-amber-300/40 bg-amber-300/10 text-amber-200"
      : "border-red-400/40 bg-red-400/10 text-red-200";

export type Records = {
  bestDay: string | null;
  bestDayXp: number;
  bountiesClaimed: number;
  fullClears: number;
  longestStreak: number;
};
