import { verifyOtpAction } from "./actions";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; error?: string }>;
}) {
  const { email = "", error } = await searchParams;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">Verify your email</h1>
      <p className="max-w-sm text-center text-sm text-zinc-600 dark:text-zinc-400">
        We sent a 6-digit code to {email || "your email"}. Enter it below.
      </p>
      {error && <p className="max-w-sm text-center text-sm text-red-600">{error}</p>}
      <form action={verifyOtpAction} className="flex w-full max-w-sm flex-col gap-3">
        <input type="hidden" name="email" value={email} />
        <input
          name="token"
          type="text"
          inputMode="numeric"
          placeholder="6-digit code"
          required
          minLength={6}
          maxLength={6}
          className="rounded border px-3 py-2 text-center tracking-widest dark:bg-zinc-900"
        />
        <button
          type="submit"
          className="rounded bg-black px-3 py-2 text-white dark:bg-white dark:text-black"
        >
          Verify
        </button>
      </form>
    </div>
  );
}
