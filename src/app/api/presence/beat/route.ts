import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// POST /api/presence/beat {kind: visit|tick, seconds} — upserts today's
// site_visits row. visit = +1 visit (once per page load); tick = +seconds.
// Anonymous hits are ignored (no user, no row).
const body = z.object({
  kind: z.enum(["visit", "tick"]),
  seconds: z.number().int().min(0).max(3600),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid." }, { status: 400 });

  const day = new Date().toISOString().slice(0, 10);
  const { data: row } = await supabase
    .from("site_visits")
    .select("visits,seconds")
    .eq("user_id", user.id)
    .eq("day", day)
    .single();
  if (!row) {
    await supabase.from("site_visits").insert({
      user_id: user.id,
      day,
      visits: parsed.data.kind === "visit" ? 1 : 0,
      seconds: parsed.data.seconds,
      last_seen: new Date().toISOString(),
    });
  } else {
    await supabase
      .from("site_visits")
      .update({
        visits: row.visits + (parsed.data.kind === "visit" ? 1 : 0),
        seconds: row.seconds + parsed.data.seconds,
        last_seen: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .eq("day", day);
  }
  return NextResponse.json({ ok: true });
}
