"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, SignInError } from "@/src/lib/auth";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await signIn(email.trim(), password);
      router.replace("/dashboard");
    } catch (caught) {
      setError(
        caught instanceof SignInError
          ? "Unable to sign in. Check your credentials and try again."
          : "Unable to sign in. Try again later.",
      );
      setIsSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-4 text-foreground">
      <form
        className="grid w-full max-w-md gap-4 rounded-lg border border-border bg-surface p-6"
        onSubmit={submit}
      >
        <div>
          <p className="text-sm font-semibold text-accent-strong">MyHub</p>
          <h1 className="mt-2 text-2xl font-semibold">Sign in</h1>
          <p className="mt-1 text-sm text-muted">
            Your private productivity hub.
          </p>
        </div>
        {error ? (
          <p className="rounded-md border border-danger-border bg-danger-surface px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <label className="grid gap-1.5 text-sm font-medium text-body">
          Email
          <input
            className="h-10 rounded-md border border-input bg-surface px-3 text-sm"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-body">
          Password
          <input
            className="h-10 rounded-md border border-input bg-surface px-3 text-sm"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>
        <button
          className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:bg-disabled"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}
