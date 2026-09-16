import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { splitTerms, matchScore, type SearchItem } from "@/lib/search";

// GET /api/search?q= — unified, RLS-enforced, grouped + ranked.
// ilike pre-filters server-side; JS ranks. Debounce + request-id handled client-side.
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ groups: [] });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ groups: [] }, { status: 401 });

  const esc = q.replace(/[%_\\]/g, (m) => `\\${m}`);
  const like = `%${esc}%`;
  const terms = splitTerms(q);

  const [co, jb, ct, em, dc, mp, gp] = await Promise.all([
    supabase.from("companies").select("id,name,location,industry,website,company_linkedin").ilike("name", like).limit(10),
    supabase.from("jobs").select("id,mission_id,title,location,status,required_skills,description,job_url,linkedin_post_url,companies(name)").or(
      `title.ilike.${like},location.ilike.${like},required_skills.ilike.${like},description.ilike.${like}`,
    ).limit(15),
    supabase.from("contacts").select("id,name,role_title,contact_type,email,phone,linkedin_url,companies(id,name)").or(
      `name.ilike.${like},role_title.ilike.${like},email.ilike.${like},linkedin_url.ilike.${like}`,
    ).limit(10),
    supabase.from("emails").select("id,email_address,email_type,display_name,source,jobs(id,mission_id,title,companies(name))").ilike("email_address", like).limit(10),
    supabase.from("documents").select("id,file_name,document_type,jobs(id,mission_id,title,companies(name))").or(
      `file_name.ilike.${like},document_type.ilike.${like}`,
    ).limit(15),
    supabase.from("my_linkedin_posts").select("id,title,body,post_type,status").or(
      `title.ilike.${like},body.ilike.${like}`,
    ).limit(10),
    supabase.from("group_posts").select("id,platform,group_name,body,status").or(
      `group_name.ilike.${like},body.ilike.${like}`,
    ).limit(10),
  ]);

  type G = { group: string; items: SearchItem[] };
  const groups: G[] = [];
  const push = (group: string, items: SearchItem[]) => {
    const ranked = items
      .map((it) => ({ it, s: it.rank }))
      .filter((r) => r.s >= 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 6)
      .map((r) => r.it);
    if (ranked.length) groups.push({ group, items: ranked });
  };

  push("COMPANIES", (co.data ?? []).map((c) => ({
    kind: "COMPANY" as const, id: `co-${c.id}`, title: c.name,
    subtitle: [c.industry, c.location].filter(Boolean).join(" · ") || "Company",
    href: `/companies?q=${encodeURIComponent(c.name)}`, rank: matchScore([c.name, c.industry, c.location], terms),
  })));

  const jobItems: SearchItem[] = [];
  const linkItems: SearchItem[] = [];
  for (const j of jb.data ?? []) {
    const co_ = j.companies as { name?: string } | null;
    jobItems.push({
      kind: "JOB", id: `job-${j.id}`, title: j.title,
      subtitle: `${co_?.name ?? ""} · ${j.location ?? ""} · ${j.status ?? ""}`.replace(/^[ ·]+/, ""),
      href: `/missions/${j.id}`,
      rank: matchScore([j.title, co_?.name, j.location, j.required_skills, j.description], terms),
    });
    if (j.linkedin_post_url) {
      linkItems.push({
        kind: "LINKEDIN", id: `post-${j.id}`, title: `Original post — ${co_?.name ?? j.title}`,
        subtitle: j.mission_id ?? "LinkedIn Post", external: j.linkedin_post_url,
        rank: matchScore([co_?.name, j.title], terms) - 5,
      });
    }
  }
  push("JOBS", jobItems);

  // Dedicated lane: searching "walk-in"/"walkin" lists every walk-in mission,
  // not just title matches. Ranked with a bonus so they surface first.
  if (terms.includes("walk") || terms.includes("walkin") || terms.join(" ").includes("walk in")) {
    const { data: wi } = await supabase
      .from("jobs")
      .select("id,mission_id,title,location,deadline,companies(name)")
      .or("description.ilike.%walk-in%,employment_type.ilike.%walk-in%")
      .limit(15);
    push(
      "WALK-INS",
      (wi ?? []).map((j) => {
        const co_ = j.companies as { name?: string } | null;
        return {
          kind: "JOB" as const,
          id: `walkin-${j.id}`,
          title: `🚶 ${j.title}`,
          subtitle: `${co_?.name ?? ""} · ${j.location ?? ""} · ${j.deadline ?? "date in post"}`.replace(/^[ ·]+/, ""),
          href: `/missions/${j.id}`,
          rank: 60 + matchScore([j.title, co_?.name, j.location], terms.filter((t) => t !== "walk" && t !== "in")),
        };
      }),
    );
  }

  const contactItems: SearchItem[] = [];
  for (const c of ct.data ?? []) {
    const co_ = c.companies as { name?: string } | null;
    contactItems.push({
      kind: "CONTACT", id: `ct-${c.id}`, title: c.name,
      subtitle: `${c.role_title ?? ""} · ${co_?.name ?? ""}`.replace(/^[ ·]+/, ""),
      href: `/contacts?q=${encodeURIComponent(c.name)}`, email: c.email ?? undefined,
      rank: matchScore([c.name, c.role_title, co_?.name, c.email, c.linkedin_url, c.contact_type], terms),
    });
    if (c.linkedin_url) {
      linkItems.push({
        kind: "LINKEDIN", id: `prof-${c.id}`, title: `${c.name} — profile`,
        subtitle: c.role_title ?? "LinkedIn Profile", external: c.linkedin_url,
        rank: matchScore([c.name], terms) - 5,
      });
    }
  }
  push("CONTACTS", contactItems);

  push("EMAILS", (em.data ?? []).map((e) => {
    const jb_ = e.jobs as unknown as { mission_id: string; title: string; companies: { name?: string } | null } | null;
    return {
      kind: "EMAIL" as const, id: `em-${e.id}`, title: e.email_address,
      subtitle: `${e.display_name ?? ""} · ${jb_?.companies?.name ?? ""} · ${e.source ?? ""}`.replace(/^[ ·]+/, ""),
      email: e.email_address, source: e.source ?? undefined,
      rank: matchScore([e.email_address, e.display_name], terms),
    };
  }));

  push("DOCUMENTS", (dc.data ?? []).map((d) => {
    const jb_ = d.jobs as unknown as { mission_id: string; title: string; companies: { name?: string } | null } | null;
    return {
      kind: "DOCUMENT" as const, id: `doc-${d.id}`, title: d.file_name,
      subtitle: `${jb_?.companies?.name ?? ""} · ${jb_?.title ?? ""} · ${d.document_type}`.replace(/^[ ·]+/, ""),
      docId: d.id,
      rank: matchScore([d.file_name, d.document_type, jb_?.companies?.name, jb_?.title, jb_?.mission_id], terms),
    };
  }));

  push("LINKEDIN", linkItems);
  const coLinks: SearchItem[] = (co.data ?? [])
    .filter((c) => c.company_linkedin)
    .map((c) => ({
      kind: "LINKEDIN" as const, id: `coli-${c.id}`, title: `${c.name} — company page`,
      subtitle: "Company LinkedIn", external: c.company_linkedin as string,
      rank: matchScore([c.name], terms) - 5,
    }));
  push("LINKEDIN", coLinks);

  push("MY POSTS", (mp.data ?? []).map((p) => ({
    kind: "MY_POST" as const, id: `mypost-${p.id}`, title: p.title ?? "Untitled post",
    subtitle: `${p.post_type ?? "Post"} · ${p.status}`,
    href: "/posts",
    rank: matchScore([p.title, p.body, p.post_type], terms),
  })));

  push("GROUP POSTS", (gp.data ?? []).map((g) => ({
    kind: "GROUP_POST" as const, id: `gp-${g.id}`, title: `${g.platform === "TELEGRAM" ? "Telegram" : "WhatsApp"} — ${g.group_name}`,
    subtitle: `${g.status} · ${(g.body ?? "").slice(0, 80)}`,
    href: "/groups",
    rank: matchScore([g.group_name, g.body], terms),
  })));

  return NextResponse.json({ groups });
}
