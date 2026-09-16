import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SectionTitle } from "@/components/ui";
import { LibraryClient, type Doc } from "./library-client";

export default async function LibraryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("documents")
    .select("id,file_name,document_type,bucket_name,storage_path,file_size,version,is_current,created_at,jobs(mission_id,title,companies(name))")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle kicker="CLOUD DRIVE" title="Document library" />
      <LibraryClient docs={(data ?? []) as unknown as Doc[]} />
    </div>
  );
}
