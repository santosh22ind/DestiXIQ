import Link from "next/link";
import { createAuthClient } from "@/lib/supabase/server-client";
import { signOutAction } from "./logout/actions";

export default async function Home() {
  const supabase = await createAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 p-16 text-center dark:bg-black">
      <h1 className="text-3xl font-semibold text-black dark:text-zinc-50">
        DestiXIQ
      </h1>
      <p className="max-w-md text-zinc-600 dark:text-zinc-400">
        Destination-specific travel briefings. Scaffold in progress — see{" "}
        <code className="rounded bg-black/[.06] px-1.5 py-0.5 font-mono text-[0.9em] dark:bg-white/[.08]">
          docs/
        </code>{" "}
        for design docs.
      </p>
      {user ? (
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Signed in as {user.email}
          </p>
          <Link href="/briefing" className="text-sm underline">
            Request a briefing
          </Link>
          <form action={signOutAction}>
            <button type="submit" className="text-sm underline">
              Sign out
            </button>
          </form>
        </div>
      ) : (
        <div className="flex gap-4 text-sm">
          <Link href="/login" className="underline">
            Log in
          </Link>
          <Link href="/signup" className="underline">
            Sign up
          </Link>
        </div>
      )}
    </div>
  );
}
