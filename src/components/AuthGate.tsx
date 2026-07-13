"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@/src/lib/auth";
import { getSession, onAuthChange } from "@/src/lib/auth";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let active = true;
    void getSession()
      .then((nextSession) => {
        if (!active) return;
        if (!nextSession) router.replace("/login");
        setSession(nextSession);
        setChecked(true);
      })
      .catch(() => {
        if (!active) return;
        router.replace("/login");
        setChecked(true);
      });

    const unsubscribe = onAuthChange((nextSession) => {
      if (!nextSession) {
        router.replace("/login");
        return;
      }
      setSession(nextSession);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [router]);

  if (!checked || !session) return null;
  return children;
}
