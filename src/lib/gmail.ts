import { createClient } from "@/lib/supabase/server";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPES = ["https://www.googleapis.com/auth/gmail.send"];

function cfg() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function gmailConfigured() {
  return cfg() !== null;
}

export function redirectUri(reqOrigin: string) {
  return `${reqOrigin}/api/gmail/callback`;
}

export function authUrl(origin: string) {
  const c = cfg();
  if (!c) throw new Error("Gmail not configured.");
  const p = new URLSearchParams({
    client_id: c.clientId,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
  });
  return `${AUTH_URL}?${p.toString()}`;
}

async function refreshAccess(userId: string, origin: string) {
  const c = cfg();
  if (!c) throw new Error("Gmail not configured.");
  const supabase = await createClient();
  const { data: acct } = await supabase
    .from("gmail_accounts")
    .select("refresh_token")
    .eq("user_id", userId)
    .single();
  if (!acct?.refresh_token) throw new Error("Gmail not connected.");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: c.clientId,
      client_secret: c.clientSecret,
      refresh_token: acct.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error("Gmail token refresh failed — reconnect Gmail.");
  const j = await res.json();
  return j.access_token as string;
}

function b64url(bytes: Uint8Array) {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function buildMime(opts: {
  from: string;
  to: string;
  subject: string;
  body: string;
  filename?: string;
  fileBytes?: Uint8Array;
}) {
  const boundary = `jhunt${Date.now().toString(36)}`;
  const enc = new TextEncoder();
  const lines = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    "MIME-Version: 1.0",
    ...(opts.filename && opts.fileBytes
      ? [`Content-Type: multipart/mixed; boundary="${boundary}"`, "", `--${boundary}`]
      : ["Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: 8bit"]),
    ...(opts.filename && opts.fileBytes
      ? [
          'Content-Type: text/plain; charset=UTF-8',
          "",
          opts.body,
          "",
          `--${boundary}`,
          `Content-Type: application/pdf; name="${opts.filename}"`,
          "Content-Transfer-Encoding: base64",
          `Content-Disposition: attachment; filename="${opts.filename}"`,
          "",
          Buffer.from(opts.fileBytes).toString("base64").replace(/(.{76})/g, "$1\r\n"),
          "",
          `--${boundary}--`,
        ]
      : ["", opts.body]),
  ];
  return b64url(enc.encode(lines.join("\r\n")));
}

/** Send via Gmail API after caller verified everything. Returns provider message id. */
export async function gmailSend(opts: {
  userId: string;
  origin: string;
  to: string;
  subject: string;
  body: string;
  filename?: string;
  fileBytes?: Uint8Array;
}) {
  const token = await refreshAccess(opts.userId, opts.origin);
  const supabase = await createClient();
  const { data: acct } = await supabase
    .from("gmail_accounts")
    .select("gmail_address")
    .eq("user_id", opts.userId)
    .single();
  const from = acct?.gmail_address ?? "me";
  const raw = buildMime({
    from,
    to: opts.to,
    subject: opts.subject,
    body: opts.body,
    filename: opts.filename,
    fileBytes: opts.fileBytes,
  });
  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    },
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gmail send failed: ${t.slice(0, 200)}`);
  }
  const j = await res.json();
  return { messageId: j.id as string, from };
}
