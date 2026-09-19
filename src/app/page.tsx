export default function Home() {
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
    </div>
  );
}
