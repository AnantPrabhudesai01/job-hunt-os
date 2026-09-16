import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// POST /api/dsa/log {topic, difficulty, title?, pattern?, link?, verdict?}.
// verdict SOLVED (default) | ATTEMPTED | REVISIT — revision queue surfaces
// anything not SOLVED that has no later SOLVED row for the same title.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const v = z
    .object({
      topic: z.string().trim().min(1).max(80),
      difficulty: z.enum(["Easy", "Medium", "Hard"]),
      title: z.string().trim().max(120).nullish(),
      pattern: z.string().trim().max(80).nullish(),
      link: z.string().trim().max(500).nullish(),
      verdict: z.enum(["SOLVED", "ATTEMPTED", "REVISIT"]).nullish(),
    })
    .safeParse(await req.json());
  if (!v.success) return NextResponse.json({ error: "Invalid." }, { status: 400 });
  const { error } = await supabase.from("dsa_solves").insert({
    user_id: user.id,
    topic: v.data.topic,
    difficulty: v.data.difficulty,
    title: v.data.title?.trim() || v.data.topic,
    pattern: v.data.pattern?.trim() || null,
    link: v.data.link?.trim() || null,
    verdict: v.data.verdict ?? "SOLVED",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
