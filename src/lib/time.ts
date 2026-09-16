// Time helpers. Storage = UTC (timestamptz). Display = Asia/Kolkata.
// Relative/approximate values are always labeled — never fake precision.
export const TZ = "Asia/Kolkata";

const dtf = new Intl.DateTimeFormat("en-IN", {
  timeZone: TZ,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const dayFmt = new Intl.DateTimeFormat("en-IN", {
  timeZone: TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function formatIST(iso: string | null | undefined): string {
  if (!iso) return "—";
  return `${dtf.format(new Date(iso))} IST`;
}

export function formatDayIST(d: Date): string {
  return dayFmt.format(d);
}

export function relative(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "unknown";
  const diff = now - new Date(iso).getTime();
  const future = diff < 0;
  const m = Math.round(Math.abs(diff) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return future ? `in ${m}m` : `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return future ? `in ${h}h` : `${h}h ago`;
  const d = Math.round(h / 24);
  if (d === 1) return future ? "tomorrow" : "yesterday";
  if (d < 30) return future ? `in ${d} days` : `${d} days ago`;
  return formatIST(iso);
}

export type Freshness =
  | { label: "Fresh"; color: string }
  | { label: string; color: string };

export function freshness(postedAt: string | null): Freshness {
  if (!postedAt)
    return { label: "Age unknown — verify listing", color: "text-zinc-500" };
  const days = (Date.now() - new Date(postedAt).getTime()) / 86400000;
  if (days < 1) return { label: "Fresh (< 24h)", color: "text-emerald-300" };
  if (days <= 3) return { label: "Recent (1–3d)", color: "text-emerald-300" };
  if (days <= 7) return { label: "Aging (4–7d)", color: "text-amber-300" };
  return { label: "Old (> 7d) — verify open", color: "text-red-300" };
}

export function deadlineStatus(deadline: string | null, now = Date.now()): {
  text: string;
  urgent: boolean;
  passed: boolean;
} {
  if (!deadline) return { text: "No deadline listed", urgent: false, passed: false };
  const diff = new Date(deadline).getTime() - now;
  if (diff <= 0) return { text: "DEADLINE PASSED", urgent: true, passed: true };
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const urgent = diff < 48 * 3600000;
  return {
    text: d > 0 ? `${d}d ${h}h remaining` : `${h}h remaining`,
    urgent,
    passed: false,
  };
}
