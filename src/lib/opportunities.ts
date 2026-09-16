// Opportunity source taxonomy + honest auto-extract helpers.
// CLIENT-SAFE (zero imports): shared by intake UI, dashboard, analytics.
// Rule: extract ONLY what is explicitly present. Never infer location from
// HQ/author/domain/phone. Missing values stay null for review, never guessed.

export type OppKind = "LINKEDIN" | "EMAIL" | "CAREERS" | "OTHER";

export const OPP_SOURCE_TYPE = {
  LINKEDIN: "LINKEDIN_POST",
  EMAIL: "EMAIL",
  APPLICATION: "APPLICATION",
  CAREERS: "COMPANY_CAREERS",
} as const;

export const KIND_LABEL: Record<OppKind, string> = {
  LINKEDIN: "LinkedIn",
  EMAIL: "Email",
  CAREERS: "Company Careers",
  OTHER: "Other",
};

/** Map a mission's stored source fields to one of the four reportable kinds. */
export function kindFor(
  sourceType: string | null | undefined,
  source: string | null | undefined,
): OppKind {
  const st = (sourceType ?? "").toUpperCase();
  const so = (source ?? "").toUpperCase();
  if (st.includes("LINKEDIN") || so.includes("LINKEDIN")) return "LINKEDIN";
  if (st.includes("EMAIL") || st === "EMAIL" || so.includes("EMAIL") || so.includes("MAIL")) return "EMAIL";
  if (
    st.includes("CAREER") ||
    so.includes("CAREER") ||
    so.includes("COMPANY WEBSITE") ||
    so.includes("PORTAL")
  )
    return "CAREERS";
  return "OTHER";
}

const URL_RE = /https?:\/\/[^\s)>\]]+/gi;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE = /(\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/g;
const DATE_RE = /\b(\d{4}-\d{2}-\d{2}|\d{1,2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s\d{2,4})\b/gi;

function labeled(text: string, names: string[]): string | null {
  for (const n of names) {
    const m = new RegExp(`^\\s*${n}\\s*[:\\-–]\\s*(.+?)\\s*$`, "im").exec(text);
    if (m && m[1] && !/^not provided|^n\/a|^none|^nil/i.test(m[1].trim()))
      return m[1].trim().slice(0, 200);
  }
  return null;
}

export type Extracted = {
  urls: string[];
  emails: string[];
  phones: string[];
  dates: string[];
  company: string | null;
  role: string | null;
  location: string | null;
  author: string | null;
  subject: string | null;
};

/**
 * Heuristic extraction from pasted post/mail text. Labeled lines
 * (Company:, Role:, Location:, …) plus URL/email/phone/date patterns.
 * Anything not found stays null — the review form, not this function,
 * is where a human confirms. Location is NEVER inferred.
 */
export function extractFromText(text: string): Extracted {
  const urls = [...new Set((text.match(URL_RE) ?? []).map((u) => u.replace(/[.,;!?]+$/, "")))].slice(0, 5);
  const emails = [...new Set(text.match(EMAIL_RE) ?? [])].slice(0, 5);
  const phones = [...new Set(text.match(PHONE_RE) ?? [])].slice(0, 3);
  const dates = [...new Set(text.match(DATE_RE) ?? [])].slice(0, 3);
  const company = labeled(text, ["Company", "Organization", "Organisation", "Hiring"]);
  const role =
    labeled(text, ["Role", "Position", "Title", "Opening for", "Hiring for", "Job title", "Role name"]);
  const location = labeled(text, ["Location", "Work location", "Job location", "Place", "Work mode", "Mode"]);
  const author = labeled(text, ["Author", "Posted by", "Poster", "Contact person", "Recruiter", "HR"]);
  const subject = labeled(text, ["Subject"]);
  return { urls, emails, phones, dates, company, role, location, author, subject };
}
