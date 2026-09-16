import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// POST /api/achievements/seen {ids[]} — dismiss celebrations (never re-pays).
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const v = z.object({ ids: z.array(z.string()).max(50) }).safeParse(await req.json());
  if (!v.success) return NextResponse.json({ error: "Invalid." }, { status: 400 });
  await supabase
    .from("user_achievements")
    .update({ celebration_seen: true })
    .eq("user_id", user.id)
    .in("achievement_id", v.data.ids);
  return NextResponse.json({ ok: true });
}
