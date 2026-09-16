import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const STATUSES = [
  "NEW", "CONTACTED", "CONNECTED", "RESPONDED", "FOLLOW-UP",
  "REFERRAL", "NO RESPONSE", "CLOSED",
] as const;

const base = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  role_title: z.string().trim().max(160).nullish(),
  company_id: z.number().int().nullish(),
  email: z.string().trim().max(160).nullish(),
  phone: z.string().trim().max(40).nullish(),
  linkedin_url: z.string().trim().max(300).nullish(),
  contact_type: z.string().trim().max(40).nullish(),
  status: z.enum(STATUSES).nullish(),
  last_contacted: z.string().nullish(),
  notes: z.string().trim().max(2000).nullish(),
});

function cleanUrl(v: string | null | undefined) {
  if (!v) return null;
  const t = v.trim();
  if (!t) return null;
  return /^https?:\/\/.+\..+/.test(t) ? t : null; // never fix up, only validate
}

async function ownCompany(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, companyId: number | null | undefined) {
  if (!companyId) return true;
  const { data } = await supabase
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .eq("user_id", userId)
    .single();
  return Boolean(data);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const body = base.safeParse(await req.json());
  if (!body.success || !body.data.name)
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  const v = { ...body.data, name: body.data.name as string };
  if (!(await ownCompany(supabase, user.id, v.company_id)))
    return NextResponse.json({ error: "Unknown company." }, { status: 400 });
  // Duplicate guard: same owner + same name + same email
  const { data: dupe } = await supabase
    .from("contacts")
    .select("id")
    .eq("user_id", user.id)
    .ilike("name", v.name)
    .limit(5);
  if (dupe && dupe.length > 0) {
    const { data: sameEmail } = await supabase
      .from("contacts")
      .select("id")
      .eq("user_id", user.id)
      .ilike("name", v.name)
      .eq("email", v.email ?? "");
    if (sameEmail && sameEmail.length > 0)
      return NextResponse.json(
        { error: "Possible duplicate exists — review before adding.", duplicateOf: sameEmail[0].id },
        { status: 409 },
      );
  }
  const linkedin = v.linkedin_url ? cleanUrl(v.linkedin_url) : null;
  if (v.linkedin_url && !linkedin)
    return NextResponse.json({ error: "LinkedIn URL looks invalid — CHECK LINK." }, { status: 400 });
  const { data, error } = await supabase
    .from("contacts")
    .insert({
      user_id: user.id,
      name: v.name,
      role_title: v.role_title || null,
      company_id: v.company_id ?? null,
      email: v.email || null,
      phone: v.phone || null,
      linkedin_url: linkedin,
      contact_type: v.contact_type || "OTHER",
      status: v.status || "NEW",
      last_contacted: v.last_contacted || null,
      notes: v.notes || null,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const body = base.extend({ id: z.number().int() }).safeParse(await req.json());
  if (!body.success)
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  const { id, ...v } = body.data;
  if (!(await ownCompany(supabase, user.id, v.company_id)))
    return NextResponse.json({ error: "Unknown company." }, { status: 400 });
  const patch: Record<string, unknown> = {};
  if (v.name !== undefined) patch.name = v.name;
  if (v.role_title !== undefined) patch.role_title = v.role_title || null;
  if (v.company_id !== undefined) patch.company_id = v.company_id;
  if (v.email !== undefined) patch.email = v.email || null;
  if (v.phone !== undefined) patch.phone = v.phone || null;
  if (v.linkedin_url !== undefined) {
    if (!v.linkedin_url) patch.linkedin_url = null;
    else {
      const ok = cleanUrl(v.linkedin_url);
      if (!ok)
        return NextResponse.json({ error: "LinkedIn URL looks invalid — CHECK LINK." }, { status: 400 });
      patch.linkedin_url = ok;
    }
  }
  if (v.contact_type !== undefined) patch.contact_type = v.contact_type;
  if (v.status !== undefined) patch.status = v.status; // manual control only
  if (v.last_contacted !== undefined) patch.last_contacted = v.last_contacted || null;
  if (v.notes !== undefined) patch.notes = v.notes || null;
  const { error } = await supabase
    .from("contacts")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await supabase
    .from("contacts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
