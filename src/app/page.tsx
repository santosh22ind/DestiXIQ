import Link from "next/link";
import { createAuthClient } from "@/lib/supabase/server-client";

export default async function Home() {
  const supabase = await createAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-20 text-center sm:px-10">
      <p className="text-sm font-medium text-ink/60">/ Travel Briefings</p>
      <h1 className="max-w-2xl text-5xl font-bold tracking-tight sm:text-6xl">
        Know before you go
      </h1>
      <p className="max-w-md text-ink/60">
        Weather, news, health alerts, civil unrest, transport disruptions, local
        events, and government advisories — summarized into one destination
        briefing.
      </p>
      <Link
        href={user ? "/briefing" : "/signup"}
        className="mt-2 inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 font-medium text-cream hover:bg-ink/90"
      >
        {user ? "Request a briefing" : "Get Started"}
        <span aria-hidden>→</span>
      </Link>
    </div>
  );
}
