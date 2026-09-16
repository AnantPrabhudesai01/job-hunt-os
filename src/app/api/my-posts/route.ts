import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// /api/my-posts — the user's OWN LinkedIn output. Fully separate from
// LinkedIn job-opportunity posts (those live on jobs via source_type).
// GET: newest first. POST: create (DRAFT default). PATCH: update by id.

const createPayload = z.object({
  url: z.string().trim().max(500).nullish(),
  title: z.string().trim().max(200).nullish(),
  body: z.string().trim().max(8000).nullish(),
  post_type: z.string().trim().max(80).nullish(),
  project_assoc: z.string().trim().max(200).nullish(),
  challenge_day: z.number().int().min(1).max(30).nullish(),
  status: z.enum(["DRAFT", "POSTED"]).default("DRAFT"),
  posted_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
});

const updatePayload = z.object({
  id: z.number().int().positive(),
  url: z.string().trim().max(500).nullish(),
  title: z.string().trim().max(200).nullish(),
  body: z.string().trim().max(8000).nullish(),
  post_type: z.string().trim().max(80).nullish(),
  project_assoc: z.string().trim().max(200).nullish(),
  challenge_day: z.number().int().min(1).max(30).nullish(),
  status: z.enum(["DRAFT", "POSTED"]).nullish(),
  posted_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  likes: z.number().int().min(0).max(1000000).nullish(),
  comments: z.number().int().min(0).max(1000000).nullish(),
  reposts: z.number().int().min(0).max(1000000).nullish(),
});

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase
    .from("my_linkedin_posts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);
  return NextResponse.json({ posts: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const parsed = createPayload.safeParse(await req.json());
  if (!parsed.success || (!parsed.data.title && !parsed.data.body))
    return NextResponse.json({ error: "Title or body required." }, { status: 400 });
  const p = parsed.data;
  const { data, error } = await supabase
    .from("my_linkedin_posts")
    .insert({
      user_id: user.id,
      url: p.url || null,
      title: p.title || (p.body ?? "").slice(0, 80) || null,
      body: p.body || null,
      post_type: p.post_type || null,
      project_assoc: p.project_assoc || null,
      challenge_day: p.challenge_day ?? null,
      status: p.status,
      posted_date: p.status === "POSTED" ? (p.posted_date ?? new Date().toISOString().slice(0, 10)) : null,
    })
    .select("id,status")
    .single();
  if (error || !data)
    return NextResponse.json({ error: "Could not save." }, { status: 500 });
  return NextResponse.json({ id: data.id, status: data.status });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const parsed = updatePayload.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  const { id, ...fields } = parsed.data;
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) clean[k] = v;
  if (clean.status === "POSTED" && !clean.posted_date)
    clean.posted_date = new Date().toISOString().slice(0, 10);
  const { error } = await supabase
    .from("my_linkedin_posts")
    .update(clean)
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Could not update." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
