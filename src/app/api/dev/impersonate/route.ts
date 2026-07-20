import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  isDevAuthEnabled,
  getDevUsers,
  DEV_SEED_PASSWORD,
  ensureDevCredentialAccount,
  buildDevLoginUrl,
  type DevUserRole,
} from "@/lib/dev-auth";
import { getRootDomain } from "@/lib/hostname";

export const runtime = "nodejs";

function getRequestOrigin(request: NextRequest): string {
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host");
  if (host) {
    return `${request.nextUrl.protocol}//${host}`;
  }
  return request.nextUrl.origin;
}

function resolveRedirectTarget(
  request: NextRequest,
  devUser: Awaited<ReturnType<typeof getDevUsers>>[number] | undefined,
  redirectParam: string | null
): string {
  if (devUser) {
    const path = redirectParam || new URL(devUser.redirectUrl).pathname;
    return new URL(path, new URL(devUser.redirectUrl).origin).toString();
  }
  const path = redirectParam || "/";
  return new URL(path, getRequestOrigin(request)).toString();
}

function forwardSessionCookies(source: Response, target: NextResponse) {
  const cookies =
    typeof source.headers.getSetCookie === "function"
      ? source.headers.getSetCookie()
      : source.headers.get("set-cookie")
        ? [source.headers.get("set-cookie")!]
        : [];

  for (const cookie of cookies) {
    target.headers.append("Set-Cookie", cookie);
  }
}

async function resolveDevUser(email: string, userId?: string) {
  let targetEmail = email;
  let targetUserId = userId;

  if (userId && !targetEmail) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { ok: false as const, error: "User not found", status: 404 };
    targetEmail = user.email;
    targetUserId = user.id;
  }

  if (!targetEmail) {
    return { ok: false as const, error: "Email required", status: 400 };
  }

  if (!targetUserId) {
    const user = await prisma.user.findUnique({ where: { email: targetEmail } });
    if (!user) return { ok: false as const, error: "User not found", status: 404 };
    targetUserId = user.id;
  }

  return { ok: true as const, targetEmail, targetUserId };
}

type DevSignInResult =
  | { ok: false; error: string; status: number }
  | { ok: true; targetEmail: string; signInResult: Response; redirectUrl: string };

async function devSignIn(email: string, userId?: string): Promise<DevSignInResult> {
  const resolved = await resolveDevUser(email, userId);
  if (!resolved.ok) {
    return { ok: false, error: resolved.error, status: resolved.status };
  }

  const { targetEmail, targetUserId } = resolved;
  await ensureDevCredentialAccount(targetUserId);

  const headersList = await headers();

  try {
    const signInResult = await auth.api.signInEmail({
      body: {
        email: targetEmail,
        password: DEV_SEED_PASSWORD,
        rememberMe: true,
      },
      headers: headersList,
      asResponse: true,
    });

    if (!signInResult.ok) {
      return { ok: false, error: "Sign-in failed — re-run npm run db:seed", status: 401 };
    }

    const devUser = (await getDevUsers()).find((u) => u.email === targetEmail);
    return {
      ok: true,
      targetEmail,
      signInResult,
      redirectUrl: devUser?.redirectUrl || "/",
    };
  } catch {
    return { ok: false, error: "Sign-in failed — re-run npm run db:seed", status: 500 };
  }
}

/**
 * GET — full-page dev login on the target host so session cookies bind to the correct origin.
 * Example: http://{tenant}.localhost:3000/api/dev/impersonate?email=owner@democafe.com&redirect=/admin
 */
export async function GET(request: NextRequest) {
  if (!isDevAuthEnabled()) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const email = request.nextUrl.searchParams.get("email");
  const role = request.nextUrl.searchParams.get("role");
  const redirectParam = request.nextUrl.searchParams.get("redirect");

  if (role === "CUSTOMER") {
    const users = await getDevUsers();
    const customer = users.find((u) => u.role === "CUSTOMER");
    if (!customer) {
      return NextResponse.json({ error: "No demo table session" }, { status: 404 });
    }
    return NextResponse.redirect(customer.redirectUrl);
  }

  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const devUsers = await getDevUsers();
  const devUser = devUsers.find((u) => u.email === email);

  // Restaurant users must sign in on their tenant subdomain; super admin on platform root.
  if (devUser && devUser.role !== "CUSTOMER") {
    const requestHost =
      request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
      request.headers.get("host") ||
      new URL(request.url).host;
    const expectedHost = new URL(devUser.redirectUrl).host;
    const rootHost = getRootDomain();
    const isRootHost =
      requestHost === rootHost ||
      requestHost === "localhost:3000" ||
      requestHost === rootHost.split(":")[0];

    if (devUser.role === "SUPER_ADMIN") {
      if (requestHost !== expectedHost) {
        return NextResponse.redirect(
          buildDevLoginUrl(devUser.redirectUrl, email, devUser.role as DevUserRole)
        );
      }
    } else if (isRootHost) {
      return NextResponse.redirect(
        buildDevLoginUrl(devUser.redirectUrl, email, devUser.role as DevUserRole)
      );
    }
  }

  const result = await devSignIn(email);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const response = NextResponse.redirect(
    resolveRedirectTarget(request, devUser, redirectParam)
  );
  forwardSessionCookies(result.signInResult, response);
  return response;
}

export async function POST(request: NextRequest) {
  if (!isDevAuthEnabled()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { userId, email, role } = body as {
    userId?: string;
    email?: string;
    role?: string;
  };

  if (role === "CUSTOMER") {
    const users = await getDevUsers();
    const customer = users.find((u) => u.role === "CUSTOMER");
    if (!customer) {
      return NextResponse.json({ error: "No demo table session" }, { status: 404 });
    }
    return NextResponse.json({ success: true, redirectUrl: customer.redirectUrl });
  }

  if (!email && !userId) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const result = await devSignIn(email || "", userId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const matchedUser = (await getDevUsers()).find(
    (u) => u.email === result.targetEmail
  );

  const response = NextResponse.json({
    success: true,
    redirectUrl: result.redirectUrl,
    loginUrl:
      matchedUser?.loginUrl ??
      buildDevLoginUrl(result.redirectUrl, result.targetEmail),
  });

  forwardSessionCookies(result.signInResult, response);
  return response;
}
