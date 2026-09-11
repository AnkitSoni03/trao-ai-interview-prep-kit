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
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-neutral-500" role="status">
        Checking your session…
      </div>
    );
  }

  if (user === null) return null;

  return <>{children}</>;
}
