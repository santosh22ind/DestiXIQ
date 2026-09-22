import Link from "next/link";
import { signOutAction } from "@/app/logout/actions";

export function TopNav({ userEmail }: { userEmail?: string | null }) {
  return (
    <header className="flex items-center justify-between px-6 py-5 sm:px-10">
      <Link href="/" className="text-lg font-bold tracking-tight">
        DestiXIQ
      </Link>
      {userEmail ? (
        <div className="flex items-center gap-4 text-sm">
          <span className="hidden text-ink/60 sm:inline">{userEmail}</span>
          <Link
            href="/briefing"
            className="underline decoration-ink/30 underline-offset-4 hover:decoration-ink"
          >
            Briefings
          </Link>
          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-cream hover:bg-ink/90"
            >
              Sign out
            </button>
          </form>
        </div>
      ) : (
        <div className="flex items-center gap-4 text-sm">
          <Link
            href="/login"
            className="underline decoration-ink/30 underline-offset-4 hover:decoration-ink"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-accent px-5 py-2 font-medium text-ink hover:bg-accent/80"
          >
            Get Started
          </Link>
        </div>
      )}
    </header>
  );
}
