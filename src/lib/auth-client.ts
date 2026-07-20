"use client";

import { createAuthClient } from "better-auth/react";

export function getAuthClient() {
  return createAuthClient({
    baseURL:
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  });
}

/** @deprecated Use getAuthClient() in event handlers for correct subdomain origin. */
export const authClient = getAuthClient();
