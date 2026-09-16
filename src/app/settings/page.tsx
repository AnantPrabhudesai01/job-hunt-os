import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { gmailConfigured } from "@/lib/gmail";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const wired = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  const { data: gmail } = await supabase
    .from("gmail_accounts")
    .select("gmail_address,created_at")
    .eq("user_id", user.id)
    .single();

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <h1 className="text-xl font-bold">Settings</h1>
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm">
        <p>
          Signed in as <span className="font-mono">{user.email}</span>
        </p>
        <p className="mt-2">
          Backend:{" "}
          {wired ? (
            <span className="text-green-400">Supabase keys present</span>
          ) : (
            <span className="text-red-400">
              Not connected — add keys to .env.local and restart
            </span>
          )}
        </p>
      </section>
      <section className="os-panel p-4 text-sm">
        <h2 className="font-display text-sm font-bold tracking-widest text-cyan-200">
          GMAIL SENDING
        </h2>
        {gmail ? (
          <p className="mt-1 text-zinc-300">
            Connected as <strong className="text-white">{gmail.gmail_address || "Gmail account"}</strong>{" "}
            <span className="text-emerald-300">● CONNECTED</span>
          </p>
        ) : gmailConfigured() ? (
          <div className="mt-1">
            <p className="text-zinc-300">
              Server keys present but no account linked. Connect via Google OAuth —
              you approve on Google's screen; no password is ever shared.
            </p>
            <Link href="/api/gmail/connect" className="btn btn-primary mt-2 text-xs">
              CONNECT GMAIL
            </Link>
          </div>
        ) : (
          <p className="mt-1 text-zinc-400">
            <span className="text-amber-300">● NOT CONFIGURED.</span> To enable
            approval-based Gmail sending, create a Google Cloud OAuth client
            (Gmail API enabled) and add{" "}
            <span className="font-mono">GOOGLE_CLIENT_ID</span> +{" "}
            <span className="font-mono">GOOGLE_CLIENT_SECRET</span> to{" "}
            <span className="font-mono">.env.local</span>, then use CONNECT GMAIL.
            Until then, outreach stays in review-and-copy mode — nothing sends by itself.
          </p>
        )}
      </section>
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-300">
        <h2 className="font-semibold text-zinc-100">API configuration</h2>
        <p className="mt-1">
          Keys live only in <span className="font-mono">.env.local</span>{" "}
          (never committed). WhatsApp and LinkedIn remain manual by design —
          the app prepares, you send.
        </p>
      </section>
    </div>
  );
}
