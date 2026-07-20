"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Like useState, but re-syncs to the latest server-provided value whenever it
 * changes (e.g. after router.refresh() re-renders a Server Component parent).
 *
 * This fixes the common "have to reload to see the update" bug where a client
 * component copies a server prop into useState once and then never reflects
 * fresh server data.
 */
export function useServerSyncedState<T>(serverValue: T) {
  const [value, setValue] = useState<T>(serverValue);
  const previousServerValue = useRef(serverValue);

  useEffect(() => {
    if (!Object.is(previousServerValue.current, serverValue)) {
      previousServerValue.current = serverValue;
      setValue(serverValue);
    }
  }, [serverValue]);

  return [value, setValue] as const;
}
