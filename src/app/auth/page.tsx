import { TurnstileWidget } from "@/components/TurnstileWidget";
import { requestOtpAction } from "./actions";

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 sm:px-10">
      <div className="w-full max-w-md">
        <p className="text-sm font-medium text-ink/60">/ Sign in</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">Enter your email</h1>
        <p className="mt-4 text-ink/60">
          We&apos;ll send a 6-digit code to verify it&apos;s you. No password needed.
        </p>
        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
        <form action={requestOtpAction} className="mt-8 flex flex-col gap-6">
          <input
            name="email"
            type="email"
            placeholder="Your email"
            required
            className="border-b border-ink/30 bg-transparent px-1 py-2 text-ink placeholder:text-ink/40 focus:border-ink focus:outline-none"
          />
          <TurnstileWidget />
          <button
            type="submit"
            className="inline-flex w-fit items-center gap-2 rounded-full bg-ink px-6 py-3 font-medium text-cream hover:bg-ink/90"
          >
            Send code
            <span aria-hidden>→</span>
          </button>
        </form>
      </div>
    </div>
  );
}
