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
    <div className="flex flex-col gap-10">
      <div>
        <p className="kicker mb-1.5">Dashboard</p>
        <h1 className="text-2xl font-semibold tracking-tight">Your kits</h1>
        <p className="mt-1 text-sm text-muted">Signed in as {user?.email}</p>
      </div>

      <CreateKitForm onCreated={load} />

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="label">All kits</h2>
          {kits && kits.length > 0 && <span className="text-xs text-muted">{kits.length} total</span>}
        </div>
        {error && (
          <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>
        )}
        {kits === null && !error ? (
          <div className="flex flex-col gap-2">
            {[0, 1].map((i) => (
              <div key={i} className="card h-[70px] animate-pulse" />
            ))}
          </div>
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
