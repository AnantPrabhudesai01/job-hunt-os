import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// POST /api/outreach/import — bulk-paste LinkedIn profile URLs (50-100 at once).
// Normalizes /in/ handles, skips non-profile URLs, dedupes within the paste
// AND against already-saved profiles. Reports { added, duplicates, invalid }.
// GET — full pipeline list, newest first.

const item = z.object({
  url: z.string().trim().max(500),
  name: z.string().trim().max(120).nullish(),
  role: z.string().trim().max(160).nullish(),
  company: z.string().trim().max(120).nullish(),
  email: z.string().trim().max(160).nullish(),
});

const payload = z.object({ items: z.array(item).min(1).max(200) });

/** Normalize a LinkedIn PEOPLE url to a stable key. Null = not a profile URL. */
export function profileKeyOf(raw: string): string | null {
  const t = raw.trim();
  const m = /^(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([A-Za-z0-9\-_À-ÿ%]+)\/?(?:[?#].*)?$/i.exec(t);
  if (!m) return null;
  return `linkedin.com/in/${m[1].toLowerCase().replace(/\/+$/, "")}`;
}

export function canonicalProfileUrl(raw: string): string {
  const key = profileKeyOf(raw) ?? raw.trim();
  return key.startsWith("http") ? key : `https://${key}`;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const parsed = payload.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });

  // Normalize + dedupe within the paste (first occurrence wins).
  const seen = new Map<string, { url: string; name?: string | null; role?: string | null; company?: string | null; email?: string | null }>();
  let invalid = 0;
  for (const it of parsed.data.items) {
    const key = profileKeyOf(it.url);
    if (!key) {
      invalid++;
      continue;
    }
    if (!seen.has(key))
      seen.set(key, { url: canonicalProfileUrl(it.url), name: it.name, role: it.role, company: it.company, email: it.email });
  }
  if (seen.size === 0) return NextResponse.json({ added: 0, duplicates: 0, invalid });

  const keys = [...seen.keys()];
  const { data: existing } = await supabase
    .from("hr_outreach")
    .select("profile_key")
    .eq("user_id", user.id)
    .in("profile_key", keys);
  const have = new Set((existing ?? []).map((r) => r.profile_key));
  const fresh = [...seen.entries()].filter(([k]) => !have.has(k));
  const duplicates = seen.size - fresh.length;

  if (fresh.length > 0) {
    const { error } = await supabase.from("hr_outreach").insert(
      fresh.map(([key, v]) => ({
        user_id: user.id,
        profile_url: v.url,
        profile_key: key,
        person_name: v.name || null,
        role_title: v.role || null,
        company_name: v.company || null,
        email: v.email || null,
        status: "SAVED",
      })),
    );
    if (error) return NextResponse.json({ error: "Could not save." }, { status: 500 });
  }
  return NextResponse.json({ added: fresh.length, duplicates, invalid });
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data, error } = await supabase
    .from("hr_outreach")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  return NextResponse.json({ rows: data ?? [] });
}
