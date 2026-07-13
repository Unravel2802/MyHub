import { supabase } from "@/src/lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";

// Auth wrapper (myhub_plan.md Part B, Phase 7). Exists so that `supabase.auth`
// is never called from a component — same reasoning as the Repository pattern
// for data: one place to change if the auth provider ever does, and components
// that can't accidentally depend on supabase-js's shape.
//
// Single-user by design (see migration 0012): there is one account, and the
// only question this module answers is "is that account signed in."

export type { Session };

export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

// Thrown for a failed sign-in. The UI shows a GENERIC message (rule 6) — never
// Supabase's raw text, which distinguishes "wrong password" from "no such user"
// and hands an attacker free account enumeration.
export class SignInError extends Error {
  readonly code = "sign_in_failed" as const;
  constructor() {
    super("Sign-in failed");
    this.name = "SignInError";
  }
}

export async function signIn(
  email: string,
  password: string,
): Promise<Session> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    // Real error to the console, generic error to the caller — rule 6.
    console.error(error);
    throw new SignInError();
  }

  return data.session;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Fires on sign-in, sign-out, and token refresh. Returns an unsubscribe
// function, so callers can clean up in an effect teardown.
export function onAuthChange(
  callback: (session: Session | null) => void,
): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });

  return () => data.subscription.unsubscribe();
}
