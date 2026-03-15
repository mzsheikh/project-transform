"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "../lib/queries";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const me = useMe();

  useEffect(() => {
    if (me.isLoading) return;
    if (me.isError) router.replace("/login");
  }, [me.isLoading, me.isError, router]);

  if (me.isLoading) return <p style={{ padding: 24 }}>Loading…</p>;
  if (me.isError) return null;

  return <>{children}</>;
}