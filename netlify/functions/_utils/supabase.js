import { createClient } from "@supabase/supabase-js";

// Admin client — uses service role key, NEVER exposed to frontend
export const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Verify a user JWT and return user data
export async function verifyToken(authHeader) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  return {
    id: data.user.id,
    username: data.user.user_metadata?.username || data.user.email,
  };
}
