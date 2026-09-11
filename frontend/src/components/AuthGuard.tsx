"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user === null) router.replace("/login");
  }, [user, router]);

  if (user === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2.5 p-8 text-sm text-muted" role="status">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-border-strong border-t-accent" />
        Checking your session…
      </div>
    );
  }

  if (user === null) return null;

  return <>{children}</>;
}
