import Link from "next/link";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { signUpAction } from "./actions";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 sm:px-10">
      <div className="w-full max-w-md">
        <p className="text-sm font-medium text-ink/60">/ Get Started</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">Create your account</h1>
        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
        <form action={signUpAction} className="mt-8 flex flex-col gap-6">
          <input
            name="email"
            type="email"
            placeholder="Your email"
            required
            className="border-b border-ink/30 bg-transparent px-1 py-2 text-ink placeholder:text-ink/40 focus:border-ink focus:outline-none"
          />
          <input
            name="password"
            type="password"
            placeholder="Password (min 8 characters)"
            required
            minLength={8}
            className="border-b border-ink/30 bg-transparent px-1 py-2 text-ink placeholder:text-ink/40 focus:border-ink focus:outline-none"
          />
          <TurnstileWidget />
          <button
            type="submit"
            className="inline-flex w-fit items-center gap-2 rounded-full bg-ink px-6 py-3 font-medium text-cream hover:bg-ink/90"
          >
            Sign up
            <span aria-hidden>→</span>
          </button>
        </form>
        <p className="mt-6 text-sm text-ink/60">
          Already have an account?{" "}
          <Link href="/login" className="underline decoration-ink/30 underline-offset-4 hover:decoration-ink">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
