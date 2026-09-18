import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// POST /api/mailshots/sent {id} — confirm YOU sent the mail from Gmail
// (I SENT IT pattern). Records only: status SENT + sent_at. Never touches
// applications, stages, or XP-for-applying logic. SENT here ≠ APPLIED.
const body = z.object({ id: z.number().int() });

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid." }, { status: 400 });
  const { error } = await supabase
    .from("mail_directory")
    .update({ status: "SENT", sent_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .eq("status", "NEW");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
