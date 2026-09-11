"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { IconLayers, IconLogout } from "./icons";

export function Navbar() {
  const { user, setUser } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await api.logout().catch(() => {});
    setUser(null);
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <IconLayers className="h-4 w-4" />
          </span>
          <span className="hidden sm:inline">AI Interview Prep Kit</span>
          <span className="sm:hidden">Prep Kit</span>
        </Link>
        {user && (
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-muted sm:inline">{user.email}</span>
            <button type="button" onClick={handleLogout} className="btn btn-ghost btn-sm">
              <IconLogout className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
