import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authUrl, gmailConfigured } from "@/lib/gmail";

// GET /api/gmail/connect — user-approved OAuth start (server-side, no secrets to browser)
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!gmailConfigured()) {
    return NextResponse.json(
      { error: "Gmail not configured — add GOOGLE_CLIENT_ID/SECRET server-side first." },
      { status: 500 },
    );
  }
  return NextResponse.redirect(authUrl(req.nextUrl.origin));
}
