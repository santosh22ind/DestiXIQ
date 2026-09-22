import { verifyOtpAction } from "./actions";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; error?: string }>;
}) {
  const { email = "", error } = await searchParams;

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 sm:px-10">
      <div className="w-full max-w-md">
        <p className="text-sm font-medium text-ink/60">/ Almost there</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">Verify your email</h1>
        <p className="mt-4 text-ink/60">
          We sent a 6-digit code to {email || "your email"}. Enter it below.
        </p>
        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
        <form action={verifyOtpAction} className="mt-8 flex flex-col gap-6">
          <input type="hidden" name="email" value={email} />
          <input
            name="token"
            type="text"
            inputMode="numeric"
            placeholder="6-digit code"
            required
            minLength={6}
            maxLength={6}
            className="border-b border-ink/30 bg-transparent px-1 py-2 text-center tracking-widest text-ink placeholder:text-ink/40 focus:border-ink focus:outline-none"
          />
          <button
            type="submit"
            className="inline-flex w-fit items-center gap-2 rounded-full bg-ink px-6 py-3 font-medium text-cream hover:bg-ink/90"
          >
            Verify
            <span aria-hidden>→</span>
          </button>
        </form>
      </div>
    </div>
  );
}
