import { cookies } from "next/headers";

export const CUSTOMER_TABLE_SESSION_COOKIE = "customer_table_session";

export async function getCustomerSessionTokenFromRequest(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(CUSTOMER_TABLE_SESSION_COOKIE)?.value ?? null;
}

export async function setCustomerSessionCookie(sessionToken: string, expiresAt: Date) {
  const cookieStore = await cookies();
  cookieStore.set(CUSTOMER_TABLE_SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearCustomerSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(CUSTOMER_TABLE_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
