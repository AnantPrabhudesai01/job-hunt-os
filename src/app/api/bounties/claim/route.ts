import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { BOUNTIES, bountyId, comboBonus, comboFor, todayKey, type BountyKey } from "@/lib/gamification";

// POST /api/bounties/claim — verify today's bounty against REAL rows, then
// award once (user_achievements PK = idempotent). Bonus via combo meter.
// Positive-only: unmet requirements return ok:false, never subtract.
const body = z.object({ key: z.enum(["first-move", "fresh-intel", "battle-ready"]) });

async function createdToday(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  day: string,
): Promise<number> {
  const { count } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .gte("created_at", `${day}T00:00:00Z`)
    .lt("created_at", `${day}T23:59:59.999Z`);
  return count ?? 0;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid bounty." }, { status: 400 });
  const key = parsed.data.key as BountyKey;
  const def = BOUNTIES.find((b) => b.key === key);
  if (!def) return NextResponse.json({ error: "Invalid bounty." }, { status: 400 });

  const day = todayKey();
  const id = bountyId(day, key);

  const { data: owned } = await supabase
    .from("user_achievements")
    .select("achievement_id")
    .like("achievement_id", "bounty-%");
  const ownedIds = new Set((owned ?? []).map((r) => r.achievement_id));
  if (ownedIds.has(id))
    return NextResponse.json({ ok: false, claimed: true, message: "Already claimed today." });

  // Verify against live rows.
  let met = false;
  if (key === "first-move") {
    const counts = await Promise.all(
      ["jobs", "companies", "contacts", "resume_versions", "email_drafts", "documents", "interview_preps", "application_events"].map(
        (t) => createdToday(supabase, t, day),
      ),
    );
    met = counts.some((c) => c > 0);
  } else if (key === "fresh-intel") {
    met = (await createdToday(supabase, "jobs", day)) > 0;
  } else {
    const [preps, { data: apps }] = await Promise.all([
      createdToday(supabase, "interview_preps", day),
      supabase.from("applications").select("id").eq("date_applied", day),
    ]);
    met = preps > 0 || (apps ?? []).length > 0;
  }
  if (!met)
    return NextResponse.json({ ok: false, message: "Not earned yet — complete the action first." });

  // Full-clear days for combo (all 3 bounty ids present for a past day).
  const days = new Set([...ownedIds].map((s) => String(s).slice(7, 17)));
  const clears = [...days].filter((d) =>
    (["first-move", "fresh-intel", "battle-ready"] as BountyKey[]).every((k) =>
      ownedIds.has(bountyId(d, k)),
    ),
  );
  const { mult, streak } = comboFor(clears, day);
  const xp = comboBonus(def.xp, mult);

  const { data: inserted } = await supabase
    .from("user_achievements")
    .insert({ user_id: user.id, achievement_id: id, xp_awarded: xp, celebration_seen: false })
    .select("achievement_id");
  if (!inserted || inserted.length === 0)
    return NextResponse.json({ ok: false, claimed: true, message: "Already claimed today." });
  await supabase.from("xp_transactions").insert({
    user_id: user.id,
    action: `Bounty: ${def.title}${streak > 0 ? ` (combo x${mult})` : ""}`,
    xp,
  });
  return NextResponse.json({ ok: true, xp, mult, streak, title: def.title });
}
