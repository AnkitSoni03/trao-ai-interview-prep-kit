"use client";

import { useCallback, useEffect, useRef } from "react";

/** Returns a function that calls `fn` with the latest args only after `delayMs` of silence. */
export function useDebouncedCallback<Args extends unknown[]>(fn: (...args: Args) => void, delayMs: number) {
  const fnRef = useRef(fn);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return useCallback(
    (...args: Args) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => fnRef.current(...args), delayMs);
    },
    [delayMs],
  );
}
