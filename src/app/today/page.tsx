import { redirect } from "next/navigation";
import Link from "next/link";
import {
  PhoneCall,
  CalendarClock,
  MessagesSquare,
  Handshake,
  GraduationCap,
  ArrowRight,
  CircleCheck,
  CircleDashed,
  Footprints,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SectionTitle, EmptyState } from "@/components/ui";
import { PrepLogger } from "@/components/prep-logger";
import { Reveal } from "@/components/reveal";

// GET /today — the morning action list. Exactly five orders, each from real
// rows with a deep link. Nothing here sends, applies, or changes status;
// every action lands on the screen where YOU confirm it.
export default async function TodayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const day = new Date().toISOString().slice(0, 10);
  const plus3 = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const fourAgo = new Date(Date.now() - 4 * 86400000).toISOString();

  const [{ data: followups }, { data: deadlines }, { data: freshPosts }, { data: hrNudge }, { data: dayRow }, { data: walkins }] =
    await Promise.all([
      supabase
        .from("follow_ups")
        .select("id,due_date,contact_name,channel,job_id,jobs(mission_id,title)")
        .eq("user_id", user.id)
        .eq("status", "PENDING")
        .lte("due_date", plus3)
        .order("due_date")
        .limit(5),
      supabase
        .from("jobs")
        .select("id,mission_id,title,deadline,companies(name)")
        .eq("user_id", user.id)
        .not("deadline", "is", null)
        .lte("deadline", plus3)
        .order("deadline")
        .limit(5),
      supabase
        .from("group_posts")
        .select("id,platform,group_name,body,created_at")
        .eq("user_id", user.id)
        .eq("status", "NEW")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("hr_outreach")
        .select("id,person_name,company_name,status,messaged_at")
        .eq("user_id", user.id)
        .in("status", ["CONNECTED", "MESSAGED"])
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("sprint_days")
        .select("interview_minutes")
        .eq("user_id", user.id)
        .eq("day_date", day)
        .limit(1),
      supabase
        .from("jobs")
        .select("id,mission_id,title,location,deadline,companies(name)")
        .eq("user_id", user.id)
        .not("deadline", "is", null)
        .lte("deadline", plus3)
        .or("description.ilike.%walk-in%,employment_type.ilike.%walk-in%")
        .order("deadline")
        .limit(3),
    ]);

  const nudge = (hrNudge ?? []).filter(
    (h) => h.status === "CONNECTED" || (h.messaged_at && h.messaged_at < fourAgo),
  ).slice(0, 5);
  const prepToday = (dayRow ?? [])[0]?.interview_minutes ?? 0;

  type Item = { chip: string; title: string; sub: string };
  type Order = {
    n: string;
    title: string;
    tagline: string;
    items: Item[];
    href: string;
    cta: string;
    icon: typeof PhoneCall;
    accent: { ring: string; tile: string; text: string; bar: string; btn: string };
  };

  const orders: Order[] = [
    {
      n: "01",
      title: "Follow-ups due",
      tagline: "People waiting on your word",
      items: (followups ?? []).map((f) => {
        const job = Array.isArray(f.jobs) ? f.jobs[0] : f.jobs;
        return {
          chip: f.due_date ?? "—",
          title: `${f.contact_name ?? "Someone"} · ${f.channel ?? "?"}`,
          sub: `${job?.mission_id ?? ""} ${job?.title ?? ""}`.trim() || "Mission link inside",
        };
      }),
      href: "/reminders",
      cta: "Open reminders",
      icon: PhoneCall,
      accent: {
        ring: "border-amber-400/25",
        tile: "bg-amber-400/10 text-amber-300",
        text: "text-amber-300",
        bar: "from-amber-400/70 to-orange-400/70",
        btn: "border-amber-400/30 text-amber-200 hover:bg-amber-400/10",
      },
    },
    {
      n: "02",
      title: "Deadlines ≤ 3 days",
      tagline: "Doors closing soonest first",
      items: (deadlines ?? []).map((d) => {
        const co = d.companies as { name?: string } | null;
        return {
          chip: d.deadline ?? "—",
          title: `${d.mission_id} ${d.title}`,
          sub: co?.name ?? "",
        };
      }),
      href: "/deadlines",
      cta: "Open deadlines",
      icon: CalendarClock,
      accent: {
        ring: "border-rose-400/25",
        tile: "bg-rose-400/10 text-rose-300",
        text: "text-rose-300",
        bar: "from-rose-400/70 to-pink-400/70",
        btn: "border-rose-400/30 text-rose-200 hover:bg-rose-400/10",
      },
    },
    {
      n: "03",
      title: "Unvisited group posts",
      tagline: "Fresh leads from your groups",
      items: (freshPosts ?? []).map((p) => ({
        chip: p.platform === "TELEGRAM" ? "TG" : "WA",
        title: p.group_name ?? "Group post",
        sub: String(p.body ?? "").slice(0, 110),
      })),
      href: "/groups",
      cta: "Open groups",
      icon: MessagesSquare,
      accent: {
        ring: "border-violet-400/25",
        tile: "bg-violet-400/10 text-violet-300",
        text: "text-violet-300",
        bar: "from-violet-400/70 to-purple-400/70",
        btn: "border-violet-400/30 text-violet-200 hover:bg-violet-400/10",
      },
    },
    {
      n: "04",
      title: "HR to nudge",
      tagline: "Warm threads going cold",
      items: nudge.map((h) => ({
        chip: h.status === "CONNECTED" ? "NEW" : "4d+",
        title: `${h.person_name ?? "Someone"} · ${h.company_name ?? "?"}`,
        sub:
          h.status === "CONNECTED"
            ? "Connected, no message yet"
            : "Messaged 4+ days ago, no reply",
      })),
      href: "/outreach",
      cta: "Open outreach",
      icon: Handshake,
      accent: {
        ring: "border-emerald-400/25",
        tile: "bg-emerald-400/10 text-emerald-300",
        text: "text-emerald-300",
        bar: "from-emerald-400/70 to-teal-400/70",
        btn: "border-emerald-400/30 text-emerald-200 hover:bg-emerald-400/10",
      },
    },
    {
      n: "05",
      title: "Interview prep today",
      tagline: "Compounding minutes",
      items:
        prepToday > 0
          ? [{ chip: `${prepToday}m`, title: "Logged so far", sub: "Keep the streak warm." }]
          : [],
      href: "/sprint",
      cta: "Open sprint",
      icon: GraduationCap,
      accent: {
        ring: "border-cyan-400/25",
        tile: "bg-cyan-400/10 text-cyan-300",
        text: "text-cyan-300",
        bar: "from-cyan-400/70 to-sky-400/70",
        btn: "border-cyan-400/30 text-cyan-200 hover:bg-cyan-400/10",
      },
    },
  ];
  const needCount = orders.filter((o) => o.items.length > 0).length;
  const urgentWalkins = (walkins ?? []).map((w) => {
    const co = w.companies as { name?: string } | null;
    const days = Math.ceil((new Date(w.deadline as string).getTime() - Date.now()) / 86400000);
    return { id: w.id, mission: w.mission_id as string | null, title: w.title as string, company: co?.name ?? "", location: (w.location as string | null) ?? "", days };
  });

  return (
    <div className="flex flex-col gap-4">
      {/* COMMAND BANNER */}
      <section className="os-panel relative overflow-hidden p-5">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-rose-400 via-violet-400 via-emerald-400 to-cyan-400"
        />
        <SectionTitle kicker="TODAY" title={`5 orders · ${needCount} need you`} />
        <div className="flex flex-wrap items-center gap-2" aria-label="Orders needing you">
          {orders.map((o) => {
            const hot = o.items.length > 0;
            const Icon = o.icon;
            return (
              <Link
                key={o.n}
                href={o.href}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold transition-colors ${
                  hot ? `${o.accent.ring} bg-white/[0.03] text-zinc-100 hover:bg-white/[0.07]` : "os-hud-line text-zinc-600"
                }`}
              >
                <Icon size={13} aria-hidden className={hot ? o.accent.text : "text-zinc-600"} />
                {o.n} · {hot ? `${o.items.length} waiting` : "clear"}
              </Link>
            );
          })}
          {orders.find((o) => o.n === "05") && (
            <span className="ml-auto">
              <PrepLogger initialMinutes={prepToday} />
            </span>
          )}
        </div>
      </section>

      {/* WALK-IN RADAR — its own lane, never mixed with deadlines */}
      {urgentWalkins.length > 0 && (
        <section className="rounded-xl border border-yellow-300/40 bg-yellow-300/[0.06] p-4" aria-label="Upcoming walk-ins">
          <div className="flex items-center gap-2">
            <Footprints size={17} aria-hidden className="shrink-0 text-yellow-200" />
            <p className="font-display text-sm font-bold tracking-wide text-yellow-100">
              WALK-IN RADAR — don&apos;t forget
            </p>
            <Link href="/walkins" className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-yellow-200">
              OPEN WALK-INS <ArrowRight size={12} aria-hidden />
            </Link>
          </div>
          <ul className="mt-2 flex flex-col gap-1.5">
            {urgentWalkins.map((w) => (
              <li key={w.id} className="flex items-center gap-2.5 text-sm">
                <span className={`shrink-0 rounded-md px-2 py-0.5 font-mono text-[11px] font-bold ${w.days <= 0 ? "bg-emerald-400/15 text-emerald-200" : "bg-yellow-300/15 text-yellow-200"}`}>
                  {w.days <= 0 ? "TODAY" : `${w.days}d`}
                </span>
                <span className="min-w-0 truncate text-zinc-100">
                  <strong>{w.mission}</strong> {w.title} · {w.company} @ {w.location}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {orders.map((o, idx) => {
        const Icon = o.icon;
        const hot = o.items.length > 0;
        return (
          <Reveal key={o.n} delay={idx * 0.03}>
            <section className={`os-panel overflow-hidden p-0 ${o.accent.ring}`}>
              <div aria-hidden className={`h-1 w-full bg-gradient-to-r ${o.accent.bar}`} />
              <div className="p-5">
                <div className="flex items-center gap-3">
                  <span className={`rounded-xl p-2.5 ${o.accent.tile}`} aria-hidden>
                    <Icon size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className={`font-display text-[11px] font-bold tracking-[0.2em] ${o.accent.text}`}>
                      ORDER {o.n}
                    </p>
                    <h3 className="font-display text-base font-bold text-white">{o.title}</h3>
                    <p className="truncate text-xs text-zinc-500">{o.tagline}</p>
                  </div>
                  <span
                    className={`ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${
                      hot ? `${o.accent.ring} ${o.accent.text}` : "os-hud-line text-zinc-600"
                    }`}
                  >
                    {hot ? (
                      <>
                        <CircleDashed size={12} aria-hidden /> {o.items.length} TO DO
                      </>
                    ) : (
                      <>
                        <CircleCheck size={12} aria-hidden /> CLEAR
                      </>
                    )}
                  </span>
                </div>

                {hot ? (
                  <ul className="mt-3 flex flex-col gap-1.5">
                    {o.items.map((it, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-3 rounded-lg border border-white/[0.04] bg-black/20 px-3 py-2 transition-colors hover:border-white/10 hover:bg-black/40"
                      >
                        <span className="shrink-0 rounded-md bg-white/[0.06] px-2 py-0.5 font-mono text-[11px] font-bold text-zinc-200">
                          {it.chip}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-zinc-100">{it.title}</span>
                          {it.sub && <span className="block truncate text-xs text-zinc-500">{it.sub}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 flex items-center gap-2 rounded-lg border border-dashed border-white/10 px-3 py-2.5 text-sm text-zinc-500">
                    <CircleCheck size={15} aria-hidden className="shrink-0 text-zinc-600" />
                    Clear — nothing waiting here.
                  </p>
                )}

                <Link
                  href={o.href}
                  className={`mt-3 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${o.accent.btn}`}
                >
                  {o.cta} <ArrowRight size={13} aria-hidden />
                </Link>
              </div>
            </section>
          </Reveal>
        );
      })}
      {needCount === 0 && (
        <EmptyState title="BOARD CLEAR" body="Nothing due. Feed the top of the funnel: capture a post from Intake." />
      )}
    </div>
  );
}
