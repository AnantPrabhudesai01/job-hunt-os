import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// POST /api/groups/ingest — capture one forwarded group post (deduplicated).
// Duplicate = same normalized text from the same platform was already captured:
// returns 409 { duplicate: true, id, status } so the sender UI can say "visited".
// GET /api/groups/ingest?platform=WHATSAPP|TELEGRAM|ALL — newest-first inbox list.

const payload = z.object({
  platform: z.enum(["WHATSAPP", "TELEGRAM"]),
  group_name: z.string().trim().min(1).max(120),
  sender_name: z.string().trim().max(120).nullish(),
  body: z.string().trim().min(1).max(20000),
  external_id: z.string().trim().max(120).nullish(),
});

/** Normalize forwarded text: forwards gain prefixes/whitespace, not meaning. */
export function hashPost(body: string) {
  const norm = body.trim().replace(/\s+/g, " ").toLowerCase();
  return createHash("sha256").update(norm).digest("hex").slice(0, 32);
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
  const { platform, group_name, sender_name, body, external_id } = parsed.data;
  const body_hash = hashPost(body);

  const { data: seen } = await supabase
    .from("group_posts")
    .select("id,status")
    .eq("user_id", user.id)
    .eq("platform", platform)
    .eq("body_hash", body_hash)
    .maybeSingle();
  if (seen)
    return NextResponse.json(
      { duplicate: true, id: seen.id, status: seen.status },
      { status: 409 },
    );

  const { data, error } = await supabase
    .from("group_posts")
    .insert({
      user_id: user.id,
      platform,
      group_name,
      sender_name: sender_name || null,
      body,
      body_hash,
      external_id: external_id || null,
      status: "NEW",
    })
    .select("id,status")
    .single();
  if (error || !data)
    return NextResponse.json({ error: "Could not save post." }, { status: 500 });
  return NextResponse.json({ duplicate: false, id: data.id, status: data.status });
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const platform = req.nextUrl.searchParams.get("platform") ?? "ALL";
  let q = supabase
    .from("group_posts")
    .select("id,platform,group_name,sender_name,body,status,mission_job_id,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);
  if (platform === "WHATSAPP" || platform === "TELEGRAM") q = q.eq("platform", platform);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  return NextResponse.json({ posts: data ?? [] });
}
