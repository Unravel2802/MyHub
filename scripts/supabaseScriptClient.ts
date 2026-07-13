import { createClient } from "@supabase/supabase-js";

export function scriptSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is required");
  if (!key) {
    console.warn(
      "SUPABASE_SERVICE_ROLE_KEY is not set; script is using the anon key and may read no rows while RLS is enabled.",
    );
  }
  const fallback = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key && !fallback)
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY is required when service role key is absent",
    );
  return createClient(url, key ?? fallback!);
}

export function prepareScriptClientAuth() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  console.warn(
    "SUPABASE_SERVICE_ROLE_KEY is not set; repository script is using the anon key and may read no rows while RLS is enabled.",
  );
}
