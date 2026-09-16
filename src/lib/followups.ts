// Follow-up queue rules: who to nudge, when, with what words. CLIENT-SAFE.
// All sends stay manual (mailbox / wa.me / LinkedIn) — the app only drafts,
// schedules, and records YOUR confirmations. Positive-only, idempotent.

// Stages where waiting on the other side means a nudge may be owed.
const ENGAGED_WAIT = new Set([
  "APPLIED", "OUTREACH", "WAITING", "RECRUITER CONTACTED", "RECRUITER RESPONDED",
  "SCREENING", "ASSESSMENT",
]);

export const needsNudge = (stage: string | null) =>
  ENGAGED_WAIT.has((stage ?? "").toUpperCase());

export type Channel = "EMAIL" | "WHATSAPP" | "LINKEDIN" | "PHONE";

export const CHANNELS: Channel[] = ["EMAIL", "WHATSAPP", "LINKEDIN", "PHONE"];

// Suggested next nudge date: 4 days after last activity, legend included.
export function suggestDate(lastActivity: string | null, today = todayKey()): string {
  const base = lastActivity ? new Date(`${lastActivity}T00:00:00Z`) : new Date(`${today}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + 4);
  return base.toISOString().slice(0, 10);
}

export const todayKey = (d = new Date()) => d.toISOString().slice(0, 10);

export const isOverdue = (due: string | null, today = todayKey()) =>
  Boolean(due) && (due as string) < today;

export function followupMessage(
  channel: Channel,
  company: string,
  role: string,
  contactName: string | null,
  daysWaiting: number,
): string {
  const who = contactName?.trim() ? ` ${contactName.trim().split(" ")[0]}` : "";
  if (channel === "WHATSAPP") {
    return (
      `Hello${who}, following up on my ${role} application at ${company} ` +
      `from ${daysWaiting} days ago. Still very interested — happy to share anything needed. Thanks!`
    );
  }
  if (channel === "LINKEDIN") {
    return (
      `Hi${who}, I applied for the ${role} role at ${company} ${daysWaiting} days ago ` +
      `and remain keen. Would appreciate any guidance on the process. Thank you!`
    );
  }
  if (channel === "EMAIL") {
    return (
      `Subject: Following up — ${role} application (${company})\n\n` +
      `Dear${who || " Hiring Manager"},\n\nI applied for the ${role} position at ${company} ` +
      `${daysWaiting} days ago and am writing to reaffirm my interest. Please let me know if any ` +
      `further information would help the review.\n\nBest regards,\nAnant Prabhudesai\n` +
      `8160551448 | anantprabhudesai444@gmail.com`
    );
  }
  // PHONE is never dialed by the app — this is your call script + agenda.
  return (
    `CALL SCRIPT — ${company} (${role})\n` +
    `Open: "Hello${who}, I'm Anant Prabhudesai, MCA 2026 fresher — I applied for ${role} ${daysWaiting} days ago. Do you have 2 minutes?"\n` +
    `Ask: current openings fit; process + timeline; anything needed from me.\n` +
    `Close: confirm callback time if offered, thank them. Log the outcome right after.`
  );
}
