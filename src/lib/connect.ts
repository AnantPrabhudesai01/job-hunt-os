// First-contact engine: LinkedIn connect notes (≤300 chars, counter-ready)
// + WhatsApp openers. CLIENT-SAFE. Manual-send only — LinkedIn caps weekly
// invites (~100 typical; bursts risk restriction), so notes stay short,
// honest, and paced by the daily connect target.

export const CONNECT_TARGETS = { daily: 25, weekly: 175, monthly: 750 };

export type NoteKind = "PEER" | "RECRUITER";

const ME = "Anant Prabhudesai, MCA 2026 fresher (React/Node/REST)";

export function buildConnectNote(
  kind: NoteKind,
  firstName: string,
  company: string,
  roleContext: string,
): string {
  const base =
    kind === "PEER"
      ? `Hi ${firstName}! I'm ${ME}. Saw you're at ${company} — ${roleContext}. Would love to connect and learn from your journey!`
      : `Hi ${firstName}! I'm ${ME}. ${roleContext} at ${company} caught my eye — I'd love to connect. Thank you!`;
  return base.length <= 300 ? base : base.slice(0, 297).trimEnd() + "…";
}

export function buildWhatsAppOpener(firstName: string, company: string, role: string): string {
  return (
    `Hello${firstName ? ` ${firstName}` : ""}, I'm Anant Prabhudesai (MCA 2026 fresher, React/Node). ` +
    `Reaching out regarding ${role} at ${company}. Happy to share my resume if there's a fit. Thanks!`
  );
}
