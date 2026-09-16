import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { redirectUri } from "@/lib/gmail";

// GET /api/gmail/callback?code= — Google redirects here after user approval.
// Exchanges code for tokens server-side; stores refresh token only.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const code = req.nextUrl.searchParams.get("code");
  const err = req.nextUrl.searchParams.get("error");
  if (err || !code) redirect("/settings?gmail=denied");

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri(req.nextUrl.origin),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) redirect("/settings?gmail=error");
  const tok = await res.json();
  if (!tok.refresh_token) redirect("/settings?gmail=no-refresh");

  // Resolve Gmail address for the FROM line
  let gmail = "";
  try {
    const me = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      { headers: { Authorization: `Bearer ${tok.access_token}` } },
    );
    if (me.ok) gmail = ((await me.json()).emailAddress as string) ?? "";
  } catch {
    gmail = "";
  }
  await supabase.from("gmail_accounts").upsert(
    { user_id: user.id, gmail_address: gmail || null, refresh_token: tok.refresh_token },
    { onConflict: "user_id" },
  );
  redirect("/settings?gmail=connected");
}
