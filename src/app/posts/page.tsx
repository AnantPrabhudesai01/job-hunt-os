import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SectionTitle, EmptyState } from "@/components/ui";
import { PostsClient, type MyPost } from "./posts-client";

// GET /posts — table-first view of MY OWN LinkedIn output.
// Never mixed with LinkedIn job opportunities (those live on missions).
export default async function PostsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let posts: MyPost[] = [];
  let setupNeeded = false;
  try {
    const { data, error } = await supabase
      .from("my_linkedin_posts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) setupNeeded = true;
    else posts = (data ?? []) as MyPost[];
  } catch {
    setupNeeded = true;
  }

  const posted = posts.filter((p) => p.status === "POSTED");
  const month = new Date().toISOString().slice(0, 7);
  const thisMonth = posted.filter((p) => (p.posted_date ?? p.created_at ?? "").startsWith(month)).length;
  const challenge = posted.filter((p) => p.challenge_day != null).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <SectionTitle kicker="MY OUTPUT" title="LinkedIn posts" />
        <Link href="/intake" className="btn btn-primary shrink-0 text-xs">
          + MY LINKEDIN POST
        </Link>
      </div>
      {!setupNeeded && (
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            [String(posted.length), "POSTS PUBLISHED"],
            [String(thisMonth), "POSTS THIS MONTH"],
            [String(challenge), "POSTS THIS CHALLENGE"],
          ].map(([v, k]) => (
            <div key={k} className="os-panel p-4">
              <p className="font-display text-2xl font-bold text-white">{v}</p>
              <p className="text-[11px] tracking-widest text-zinc-500">{k}</p>
            </div>
          ))}
        </div>
      )}
      {setupNeeded ? (
        <section className="os-panel p-5">
          <SectionTitle kicker="SETUP" title="One-time database step" />
          <p className="mt-2 text-sm text-zinc-300">
            This view needs its table. In Supabase Dashboard → SQL Editor, paste and run{" "}
            <span className="font-mono">supabase/migration_015.sql</span> once, then reload.
          </p>
        </section>
      ) : posts.length === 0 ? (
        <EmptyState
          title="NO POSTS TRACKED YET"
          body="Capture your first post from Intake → + MY LINKEDIN POST. Drafts stay drafts until you mark them posted."
        />
      ) : (
        <PostsClient initial={posts} />
      )}
    </div>
  );
}
