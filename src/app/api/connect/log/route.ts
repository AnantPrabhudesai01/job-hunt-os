import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// POST /api/connect/log {contactId?} — confirm YOU sent a LinkedIn invite
// (I SENT IT pattern). Manual-confirm only; +5 XP per logged invite.
// Invite SAFETY: LinkedIn throttles weekly invites; pace via the 25/day target.
const body = z.object({ contactId: z.number().int().nullish(), name: z.string().trim().max(120).nullish() });

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid." }, { status: 400 });

  let companyId: number | null = null;
  let contactId: number | null = null;
  let label = parsed.data.name?.trim() || "LinkedIn invite";
  if (parsed.data.contactId) {
    const { data: ct } = await supabase
      .from("contacts")
      .select("id,name,company_id")
      .eq("id", parsed.data.contactId)
      .eq("user_id", user.id)
      .single();
    if (!ct) return NextResponse.json({ error: "Contact not found." }, { status: 404 });
    contactId = ct.id;
    companyId = ct.company_id;
    label = ct.name;
  }
  const { error } = await supabase.from("communications").insert({
    user_id: user.id,
    job_id: null,
    company_id: companyId,
    contact_id: contactId,
    channel: "LINKEDIN",
    status: "INVITE_SENT",
    notes: `Manual LinkedIn invite to ${label} (user-confirmed).`,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabase.from("xp_transactions").insert({
    user_id: user.id,
    action: `LinkedIn invite sent: ${label}`,
    xp: 5,
  });
  const day = new Date().toISOString().slice(0, 10);
  const { count } = await supabase
    .from("communications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("channel", "LINKEDIN")
    .eq("status", "INVITE_SENT")
    .gte("created_at", `${day}T00:00:00Z`)
    .lt("created_at", `${day}T23:59:59.999Z`);
  return NextResponse.json({ ok: true, xp: 5, today: count ?? 0 });
}
