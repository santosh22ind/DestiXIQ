import Link from "next/link";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { signInAction } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">Log in</h1>
      {error && <p className="max-w-sm text-center text-sm text-red-600">{error}</p>}
      <form action={signInAction} className="flex w-full max-w-sm flex-col gap-3">
        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          className="rounded border px-3 py-2 dark:bg-zinc-900"
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          required
          className="rounded border px-3 py-2 dark:bg-zinc-900"
        />
        <TurnstileWidget />
        <button
          type="submit"
          className="rounded bg-black px-3 py-2 text-white dark:bg-white dark:text-black"
        >
          Log in
        </button>
      </form>
      <p className="text-sm">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
