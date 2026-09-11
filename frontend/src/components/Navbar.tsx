"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";

export function Navbar() {
  const { user, setUser } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await api.logout().catch(() => {});
    setUser(null);
    router.push("/login");
  }

  return (
    <header className="border-b border-neutral-200 dark:border-neutral-800">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="font-semibold tracking-tight">
          AI Interview Prep Kit
        </Link>
        {user && (
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden text-neutral-500 sm:inline">{user.email}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md border border-neutral-300 px-3 py-1.5 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
