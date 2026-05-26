import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!URL || !ANON || !SR) {
  throw new Error(
    "Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY). " +
      "Ensure .env.local is loaded by tests/setup.ts.",
  );
}

export function adminClient(): SupabaseClient<Database> {
  return createClient<Database>(URL, SR, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Admin API로 사용자 생성 + signInWithPassword로 세션 획득.
 * 반환된 client는 해당 사용자의 JWT가 내부에 저장된 상태.
 */
export async function createSignedInUser(label: string) {
  const admin = adminClient();
  const email = `test-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  const password = "TestPassword!1234";

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr) throw createErr;
  const userId = created.user!.id;

  const userClient = createClient<Database>(URL, ANON);
  const { error: signInErr } = await userClient.auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr) throw signInErr;

  return { userId, email, client: userClient };
}

export async function deleteUser(userId: string) {
  const admin = adminClient();
  await admin.auth.admin.deleteUser(userId);
}
