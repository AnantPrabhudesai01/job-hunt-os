// 30-Day Career Sprint core: roadmap, slot definitions, scoring, XP.
// CLIENT-SAFE — zero server imports. Server writes live in /api/sprint/*.
export const SPRINT_LEN = 30;
export const DAILY_APP_TARGET = 100;
export const SPRINT_TOTAL_TARGET = 3000;

export type LSlot = "L1" | "L2" | "L3" | "L4" | "L5";

export const LSLOTS: { slot: LSlot; label: string; hint: string }[] = [
  { slot: "L1", label: "Daily LeetCode", hint: "Use the day's official daily problem when available." },
  { slot: "L2", label: "Random", hint: "Random pick from an appropriate difficulty/category mix." },
  { slot: "L3", label: "Design / LLD / Systems", hint: "Rotate: LLD, OOP design, API design, data modelling, caching, rate limiting, system-design fundamentals." },
  { slot: "L4", label: "Array / String / Core DSA", hint: "Rotate array/string/core patterns. No repeats unless marked review." },
  { slot: "L5", label: "SQL / Database", hint: "One SQL or database problem per day." },
];

export const L3_ROTATION = [
  "LLD",
  "OOP design",
  "API design",
  "Data modelling",
  "Caching",
  "Rate limiting",
  "System design fundamentals",
];

export type RoadmapDay = { day: number; name: string; category: string; suggestion: string };

export const ROADMAP: RoadmapDay[] = [
  { day: 1, name: "Job Application Tracker Lite", category: "Web", suggestion: "CRUD + filters; any stack you know" },
  { day: 2, name: "Resume Keyword Analyzer", category: "Web", suggestion: "Text compare UI; file input" },
  { day: 3, name: "Developer Portfolio Dashboard", category: "Web", suggestion: "Cards, dark UI, responsive" },
  { day: 4, name: "Expense Tracker", category: "Web", suggestion: "Local persistence, charts" },
  { day: 5, name: "REST API Monitor", category: "Backend", suggestion: "Polling, status history" },
  { day: 6, name: "URL Shortener", category: "Backend", suggestion: "Hashing, redirects, DB" },
  { day: 7, name: "Authentication System", category: "Backend", suggestion: "Hashing, sessions/JWT" },
  { day: 8, name: "Job Application Kanban", category: "Web", suggestion: "Drag-and-drop board" },
  { day: 9, name: "Notes / Knowledge Base", category: "Web", suggestion: "Markdown, search" },
  { day: 10, name: "File Upload & Document Manager", category: "Backend", suggestion: "Uploads, previews" },
  { day: 11, name: "AI Resume Reviewer", category: "AI", suggestion: "LLM API, structured feedback" },
  { day: 12, name: "AI Interview Question Generator", category: "AI", suggestion: "Prompt templates, bank output" },
  { day: 13, name: "AI Meeting/Interview Summarizer", category: "AI", suggestion: "Transcript in, summary out" },
  { day: 14, name: "OCR Document Extractor", category: "AI", suggestion: "OCR + field parsing" },
  { day: 15, name: "AI Chat With Documents", category: "AI", suggestion: "Retrieval over uploads" },
  { day: 16, name: "Inventory Management API", category: "Backend", suggestion: "REST, validation, stock logic" },
  { day: 17, name: "Analytics Dashboard", category: "Web", suggestion: "Charts from an API" },
  { day: 18, name: "Job Recommendation Engine", category: "Backend", suggestion: "Scoring heuristic, ranked list" },
  { day: 19, name: "Notification Service", category: "Backend", suggestion: "Queues, templates" },
  { day: 20, name: "API Rate Limiter", category: "Backend", suggestion: "Token bucket, headers" },
  { day: 21, name: "Dockerize a Full-stack Application", category: "DevOps", suggestion: "Multi-stage build, compose" },
  { day: 22, name: "GitHub Actions CI/CD Pipeline", category: "DevOps", suggestion: "Lint, test, deploy" },
  { day: 23, name: "Cloud File Storage App", category: "DevOps", suggestion: "Object storage, signed URLs" },
  { day: 24, name: "Background Job Worker", category: "Backend", suggestion: "Queue + worker process" },
  { day: 25, name: "Monitoring Dashboard", category: "DevOps", suggestion: "Health checks, uptime chart" },
  { day: 26, name: "Mini Applicant Tracking System", category: "Web", suggestion: "Pipeline stages, notes" },
  { day: 27, name: "AI Job Matching Engine", category: "AI", suggestion: "Match scoring, explanations" },
  { day: 28, name: "Developer Productivity OS", category: "Web", suggestion: "Habits, timers, streaks" },
  { day: 29, name: "Real-time Collaboration App", category: "Web", suggestion: "WebSockets, presence" },
  { day: 30, name: "Career Intelligence Dashboard", category: "Web", suggestion: "Aggregate your own sprint data" },
];

export type DayGoals = {
  apps: boolean;
  leetcode: boolean;
  project: boolean;
  github: boolean;
  linkedin: boolean;
};

/** 5 equal goals × 20%. Never confuse with the 73/100 count. */
export function scoreDay(g: DayGoals): { done: number; pct: number } {
  const done = [g.apps, g.leetcode, g.project, g.github, g.linkedin].filter(Boolean).length;
  return { done, pct: done * 20 };
}

export const SPRINT_XP = {
  goal: 10, // per completed goal, awarded once per run/day/goal
  perfectDay: 50, // 5/5 bonus, once per day
} as const;

export function sprintMissionKey(runId: number, day: number, goal: string): string {
  return `SPRINT-${runId}-D${day}-${goal}`;
}

export type DayState = "LOCKED" | "TODAY" | "IN_PROGRESS" | "COMPLETED" | "MISSED";

/** Calendar state: future = LOCKED, past editable per spec (never hard-lock history). */
export function dayState(dayDate: string, todayKey: string, completed5of5: boolean): DayState {
  if (completed5of5) return "COMPLETED";
  if (dayDate === todayKey) return "TODAY";
  if (dayDate < todayKey) return "IN_PROGRESS"; // history stays editable
  return "LOCKED";
}
