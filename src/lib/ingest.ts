// Ingestion helpers: normalization + identity + mission-ID sequencing.
// Pure functions only (no DB) so the rules stay unit-testable and shared.
// Identity policy: exact URLs win; fuzzy company match never creates facts.

export function normCompany(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*\((inferred|inferred from email domain)[^)]*\)/gi, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9+#.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Workbook/app placeholder text is NOT a URL and must never be stored as one. */
export function isPlaceholderUrl(v: string | null | undefined): boolean {
  if (!v) return true;
  const t = v.trim();
  if (!t) return true;
  return /^not provided/i.test(t);
}

/** Validated http(s) URL or null. Never fixes up, only validates (matches contacts convention). */
export function cleanHttpUrl(v: string | null | undefined): string | null {
  if (!v || isPlaceholderUrl(v)) return null;
  const t = v.trim();
  return /^https?:\/\/.+\..+/.test(t) ? t : null;
}

const MISSION_RE = /^ANANT-(\d{4})-(\d{4})$/;

/** Next mission ID above the highest ANANT-YYYY-NNNN held. Never reuses, never fills gaps. */
export function nextMissionId(held: (string | null | undefined)[], year?: string): string {
  const y = year ?? String(new Date().getFullYear());
  let max = 0;
  for (const m of held) {
    if (!m) continue;
    const mt = MISSION_RE.exec(m.trim().toUpperCase());
    if (mt && mt[1] === y) max = Math.max(max, Number(mt[2]));
  }
  return `ANANT-${y}-${String(max + 1).padStart(4, "0")}`;
}

/** Blank (null/empty/whitespace) check for fill-blanks-only updates. */
export function isBlank(v: string | null | undefined): boolean {
  return !v || !v.trim();
}
