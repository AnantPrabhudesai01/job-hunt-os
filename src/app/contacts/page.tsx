import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SectionTitle } from "@/components/ui";
import { Reveal } from "@/components/reveal";
import { ContactsClient } from "./contacts-client";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: contacts }, { data: companies }, { data: jobs }] =
    await Promise.all([
      supabase
        .from("contacts")
        .select(
          "id,name,role_title,contact_type,email,phone,linkedin_url,status,notes,created_at,last_contacted,companies(id,name)",
        )
        .order("created_at", { ascending: false }),
      supabase.from("companies").select("id,name").order("name"),
      supabase.from("jobs").select("id,title,mission_id,company_id"),
    ]);

  return (
    <div className="flex flex-col gap-4">
      <Reveal>
        <SectionTitle kicker="ALLIES" title="Network — Contact Intelligence" />
      </Reveal>
      <ContactsClient
        contacts={(contacts ?? []) as never}
        companies={(companies ?? []) as never}
        jobs={(jobs ?? []) as never}
        initialQuery={((await searchParams)?.q ?? "").slice(0, 80)}
      />
    </div>
  );
}
