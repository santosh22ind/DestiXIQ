import { createServiceClient } from "@/lib/supabase/server";

const DAILY_LIMIT = Number(process.env.DAILY_GENERATION_LIMIT ?? 10);

export async function checkAndIncrementRateLimit(
  userId: string,
): Promise<{ allowed: boolean; count: number; limit: number }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("increment_rate_limit", {
    p_user_id: userId,
  });

  if (error) {
    throw new Error(`Rate limit check failed: ${error.message}`);
  }

  const count = data as number;
  return { allowed: count <= DAILY_LIMIT, count, limit: DAILY_LIMIT };
}
