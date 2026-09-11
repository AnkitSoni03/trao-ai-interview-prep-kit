"use client";

import { useCallback, useEffect, useState } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { CreateKitForm } from "@/components/CreateKitForm";
import { KitList } from "@/components/KitList";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import type { KitRecord } from "@/lib/types";

function Dashboard() {
  const { user } = useAuth();
  const [kits, setKits] = useState<KitRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .listKits()
      .then((d) => setKits(d.kits))
      .catch(() => setError("Could not load your kits."));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Poll while anything is still generating, so status badges update without a manual refresh.
  useEffect(() => {
    const anyInFlight = kits?.some((k) => k.status !== "ready" && k.status !== "failed");
    if (!anyInFlight) return;
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, [kits, load]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">Your kits</h1>
        <p className="text-sm text-neutral-500">Signed in as {user?.email}</p>
      </div>

      <CreateKitForm onCreated={load} />

      <div>
        <h2 className="mb-3 text-sm font-medium text-neutral-500">All kits</h2>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {kits === null && !error ? (
          <p className="text-sm text-neutral-500">Loading…</p>
        ) : (
          <KitList kits={kits ?? []} onChange={load} />
        )}
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <AuthGuard>
      <Dashboard />
    </AuthGuard>
  );
}
