import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SectionTitle, EmptyState } from "@/components/ui";
import { Reveal } from "@/components/reveal";
import { MailshotCard } from "./mailshot-card";

// GET /mailshots — bulk mail directory. Separate from missions on purpose:
// these are directory mails, not applications. Card shows HR/person +
// company names when known. One shared general resume for all; drafts are
// mail-merged (name/company fill-in only, never invented). You send from
// Gmail; I SENT IT only records.
export const dynamic = "force-dynamic";

const PAGE = 50;

export function draftFor(row: {
  email: string;
  company: string | null;
  person: string | null;
}): { subject: string; body: string } {
  const co = row.company?.trim() || "your team";
  const who = row.person?.trim() || "Hiring Manager";
  return {
    subject: `Fresher Application (MCA 2026) | Anant Prabhudesai${
      row.company?.trim() ? ` — ${row.company.trim()}` : ""
    }`,
    body: [
      `To: ${row.email}`,
      `Subject: Fresher Application (MCA 2026) | Anant Prabhudesai`,
      `Attachment: Anant Prabhudesai - General - All Purpose.pdf`,
      ``,
      `Hello ${who} / ${co},`,
      ``,
      `I am Anant Prabhudesai (MCA 2026, AI/ML Specialization — immediate joiner, plus BCA in Gaming Technology). I am reaching out as a fresher for suitable entry-level openings on your team.`,
      ``,
      `My base: full-stack fundamentals (React, Node.js, REST APIs, SQL/NoSQL), testing discipline, documentation habits, and 10 months of internship delivery. Resume attached with details.`,
      ``,
      `Contact: +91 8160551448 | anantprabhudesai444@gmail.com | linkedin.com/in/anant-prabhudesai-93982a207`,
      ``,
      `Thank you for your time and consideration.`,
      ``,
      `Best regards,`,
      `Anant Prabhudesai`,
    ].join("\n"),
  };
}

export default async function MailshotsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; st?: string; p?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const sp = (await searchParams) ?? {};
  const q = (sp.q ?? "").trim().slice(0, 80);
  const st = sp.st === "SENT" ? "SENT" : sp.st === "NEW" ? "NEW" : "ALL";
  const page = Math.max(0, parseInt(sp.p ?? "0", 10) || 0);

  let query = supabase
    .from("mail_directory")
    .select("id,email,company,person,title,phone,status,sent_at", {
      count: "exact",
    })
    .eq("user_id", user.id)
    .order("id");
  if (st !== "ALL") query = query.eq("status", st);
  if (q) {
    const esc = q.replace(/[%_\\]/g, (m) => `\\${m}`);
    query = query.or(
      `email.ilike.%${esc}%,company.ilike.%${esc}%,person.ilike.%${esc}%`,
    );
  }
  const { data: rows, count } = await query.range(
    page * PAGE,
    page * PAGE + PAGE - 1,
  );

  const { count: sentCount } = await supabase
    .from("mail_directory")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "SENT");

  // Shared general resume: first cloud object under the general prefix.
  const { data: resumeUrl } = await (async () => {
    const prefix = `${user.id}/general/all-purpose`;
    const { data: files } = await supabase.storage
      .from("resumes")
      .list(prefix, { limit: 5 });
    const pdf = (files ?? []).find((f) => f.name.endsWith(".pdf"));
    if (!pdf) return { data: null as string | null };
    const { data } = await supabase.storage
      .from("resumes")
      .createSignedUrl(`${prefix}/${pdf.name}`, 3600);
    return { data: data?.signedUrl ?? null };
  })();

  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const link = (p: number) =>
    `/mailshots?q=${encodeURIComponent(q)}&st=${st}&p=${p}`;

  return (
    <div className="flex flex-col gap-4">
      <Reveal>
        <SectionTitle
          kicker="BULK OUTREACH"
          title={`Mailshots (${total})`}
        />
        <p className="mt-1 text-xs text-zinc-400">
          Directory mails, not missions. {sentCount ?? 0} sent ·{" "}
          {total - (sentCount ?? 0)} waiting · one shared general resume for
          all · you send from Gmail, I SENT IT only records.
        </p>
        <form method="get" className="mt-3 flex flex-wrap gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search mail, company, person…"
            maxLength={80}
            className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-sky-500"
          />
          <input type="hidden" name="st" value={st} />
          <button
            type="submit"
            className="rounded-md bg-sky-600 px-3 py-2 text-sm font-semibold hover:bg-sky-500"
          >
            Search
          </button>
        </form>
        <div className="mt-2 flex gap-2 text-xs">
          {(["ALL", "NEW", "SENT"] as const).map((s) => (
            <Link
              key={s}
              href={`/mailshots?q=${encodeURIComponent(q)}&st=${s}&p=0`}
              className={`rounded-md border px-2.5 py-1 font-bold ${
                st === s
                  ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200"
                  : "border-zinc-700 text-zinc-400"
              }`}
            >
              {s}
            </Link>
          ))}
        </div>
      </Reveal>
      {!rows || rows.length === 0 ? (
        <EmptyState
          title="NO MAILS HERE"
          body="Nothing matches. Clear search or switch tabs."
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {rows.map((r) => {
            const d = draftFor(r);
            return (
              <li key={r.id}>
                <MailshotCard row={r} draft={d} resumeUrl={resumeUrl} />
              </li>
            );
          })}
        </ul>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-zinc-400">
          <Link
            href={link(Math.max(0, page - 1))}
            className={page === 0 ? "pointer-events-none opacity-30" : "text-cyan-300"}
          >
            ← Prev
          </Link>
          <span>
            Page {page + 1} / {pages}
          </span>
          <Link
            href={link(Math.min(pages - 1, page + 1))}
            className={
              page >= pages - 1
                ? "pointer-events-none opacity-30"
                : "text-cyan-300"
            }
          >
            Next →
          </Link>
        </div>
      )}
    </div>
  );
}
