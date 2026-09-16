import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SectionTitle } from "@/components/ui";
import { GroupsClient, type GroupPost } from "./groups-client";

// GET /groups — separate inbox for job posts forwarded from WhatsApp and
// Telegram groups. Duplicates are rejected at ingest (already visited).
export default async function GroupsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let posts: GroupPost[] = [];
  let setupNeeded = false;
  try {
    const { data, error } = await supabase
      .from("group_posts")
      .select("id,platform,group_name,sender_name,body,status,mission_job_id,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) setupNeeded = true;
    else posts = (data ?? []) as GroupPost[];
  } catch {
    setupNeeded = true;
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle kicker="SIGNALS" title="Group posts" />
      <GroupsClient initial={posts} setupNeeded={setupNeeded} />
    </div>
  );
}
