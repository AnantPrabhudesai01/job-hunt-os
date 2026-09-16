// Role-aware outreach copy. Every message names the ACTUAL role / company /
// skills from the stored posting — never a swapped-name template.
//
// Rules honored here:
// - Manual-only (R9): these builders only produce text to copy; nothing sends.
// - ≤300 chars for LinkedIn connect notes (fit300 truncates at a word edge).
// - No invented facts: location openness is stated intent ("Open to X"),
//   never a done deed; unknown skills fall back to honest generic hooks.

export type CopyCtx = {
  first: string;
  role: string;
  company: string;
  requiredSkills: string | null;
  location?: string | null;
};

const JUNK = /not provided|as posted|\(mandatory\)|\(tracked[^)]*\)/gi;

function cleanSkills(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .replace(JUNK, "")
    .split(/[,;|]/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length > 1 && !/^not found$/i.test(s))
    .slice(0, 6);
}

function familyOf(title: string): string {
  const t = title.toLowerCase();
  if (/(qa|test|quality)/.test(t)) return "qa";
  if (/\b(ai|ml|genai|data scientist)\b/.test(t)) return "ai";
  if (/(frontend|react|angular|web designer|ui)/.test(t)) return "frontend";
  if (/(cloud|support|devops|network|admin)/.test(t)) return "support";
  if (/(business development|bde|sales|talent acquisition|recruit|hr)\b/.test(t)) return "sales";
  if (/(android|flutter|mobile|ios)/.test(t)) return "mobile";
  if (/(backend|node|python|java|full.?stack|sde|software (developer|engineer|trainee)|devops)/.test(t)) return "backend";
  if (/(c\/c\+\+|\bc\b.*developer|embedded)/.test(t)) return "systems";
  return "general";
}

const FAMILY_HOOK: Record<string, string> = {
  qa: "validation + defect-logging",
  ai: "GenAI/OCR integration",
  frontend: "React + REST APIs",
  support: "troubleshooting + monitoring",
  sales: "outreach + follow-up discipline",
  mobile: "UI + API integration",
  backend: "REST APIs + auth/data layers",
  systems: "C/C++ + DSA fundamentals",
  general: "full-stack basics",
};

/** Short skill hook for a role, e.g. "Manual Testing + REST APIs". */
export function skillHook(requiredSkills: string | null, title: string): string {
  const skills = cleanSkills(requiredSkills);
  if (skills.length === 0) return FAMILY_HOOK[familyOf(title)];
  const short = (s: string) =>
    s
      .replace(/\(.*?\)/g, "")
      .replace(/\s*(development|developer|engineering|engineer)\s*/gi, "")
      .trim();
  const picks = skills.map(short).filter(Boolean).slice(0, 2);
  if (picks.length === 0) return FAMILY_HOOK[familyOf(title)];
  return picks.join(" + ").slice(0, 64);
}

function openTo(location?: string | null): string {
  if (!location || /not provided|unknown|^-$/i.test(location)) return "";
  if (/pune/i.test(location)) return "";
  return ` Open to ${location.split("/")[0].trim()}.`;
}

/** WhatsApp-first-touch default — role/company/skill specific. */
export function waDefaultFor(ctx: CopyCtx): string {
  const hook = skillHook(ctx.requiredSkills, ctx.role);
  return (
    `Hi ${ctx.first}, I'm Anant — MCA 2026 fresher. ` +
    `Saw the ${ctx.role} opening at ${ctx.company}; my ${hook} maps well.${openTo(ctx.location)} ` +
    `Resume ready to share — would be glad to be considered!`
  );
}

/** LinkedIn connect note, always ≤300 chars. */
export function liNoteFor(ctx: CopyCtx): string {
  const hook = skillHook(ctx.requiredSkills, ctx.role);
  const at = ctx.company && !/unknown/i.test(ctx.company) ? ` at ${ctx.company}` : "";
  const roleWord = /roles$/i.test(ctx.role.trim()) ? ctx.role.trim() : `${ctx.role} roles`;
  return fit300(
    `Hi ${ctx.first}, I'm Anant (MCA 2026, ${hook}) exploring ${roleWord}${at}. Would love to connect!`,
  );
}

/** LinkedIn post-connect message, always ≤300 chars. */
export function liMessageFor(ctx: CopyCtx): string {
  const hook = skillHook(ctx.requiredSkills, ctx.role);
  return fit300(
    `Hi ${ctx.first}, thanks for connecting! I'm Anant (MCA 2026, ${hook}, immediate joiner). If any fresher-friendly opening fits, I'd be glad to share my resume.`,
  );
}

export function fit300(s: string): string {
  if (s.length <= 300) return s;
  return s.slice(0, 297).replace(/\s+\S*$/, "") + "…";
}
