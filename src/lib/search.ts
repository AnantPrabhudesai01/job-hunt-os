export type SearchItem = {
  kind: "COMPANY" | "JOB" | "CONTACT" | "EMAIL" | "DOCUMENT" | "LINKEDIN" | "MY_POST" | "GROUP_POST";
  id: string;
  title: string;
  subtitle: string;
  href?: string;
  external?: string;
  docId?: number;
  email?: string;
  source?: string;
  rank: number;
};

export function norm(s: string | null | undefined) {
  return (s ?? "").toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
}

// AND semantics over terms; relevance: exact > prefix > partial.
export function matchScore(haystacks: (string | null | undefined)[], terms: string[]): number {
  const hay = ` ${norm(haystacks.filter(Boolean).join(" "))} `;
  let s = 0;
  for (const t of terms) {
    if (!hay.includes(t)) return -1;
    if (hay.includes(` ${t} `)) s += 40;
    else if (hay.split(" ").some((w) => w.startsWith(t))) s += 20;
    else s += 5;
  }
  return s;
}

export function splitTerms(q: string): string[] {
  return norm(q).split(" ").filter(Boolean);
}
