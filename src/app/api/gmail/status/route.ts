import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { gmailConfigured } from "@/lib/gmail";

// GET /api/gmail/status — { configured, connected, address }
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ configured: false, connected: false });
  const { data } = await supabase
    .from("gmail_accounts")
    .select("gmail_address")
    .eq("user_id", user.id)
    .single();
  return NextResponse.json({
    configured: gmailConfigured(),
    connected: Boolean(data),
    address: data?.gmail_address ?? null,
  });
}
