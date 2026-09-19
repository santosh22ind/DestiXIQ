import { NextResponse } from "next/server";
import { z } from "zod";

const requestSchema = z.object({
  destinationId: z.string().uuid(),
  dateRangeStart: z.string(),
  dateRangeEnd: z.string(),
  forceRegenerate: z.boolean().default(false),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Auth check, rate-limit check, cache lookup, and the LangGraph pipeline
  // run (see docs/technical-design.md §3.1) are not wired up yet.
  return NextResponse.json(
    { error: "not_implemented" },
    { status: 501 },
  );
}
