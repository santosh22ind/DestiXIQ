import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthClient } from "@/lib/supabase/server-client";

const requestSchema = z.object({
  destinationId: z.string().uuid(),
  dateRangeStart: z.string(),
  dateRangeEnd: z.string(),
  forceRegenerate: z.boolean().default(false),
});

export async function POST(request: Request) {
  const supabase = await createAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Rate-limit check, cache lookup, and the LangGraph pipeline run
  // (see docs/technical-design.md §3.1) are not wired up yet.
  return NextResponse.json(
    { error: "not_implemented" },
    { status: 501 },
  );
}
