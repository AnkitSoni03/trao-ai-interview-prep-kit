"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import type { User } from "./types";

/** undefined = still checking, null = signed out, User = signed in. */
export function useAuth() {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  const refresh = useCallback(() => {
    api
      .me()
      .then((d) => setUser(d.user))
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { user, refresh, setUser };
}
