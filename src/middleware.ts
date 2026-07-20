import { NextRequest, NextResponse } from "next/server";
import { parseMiddlewareHostname } from "@/lib/middleware-hostname";
import {
  checkSharedSlidingWindowLimit,
  getClientIpFromHeaders,
} from "@/lib/rate-limit";

const PUBLIC_PATHS = [
  "/api/auth",
  "/api/webhooks",
  "/api/cron",
  "/api/upload",
  "/_next",
  "/favicon.ico",
  "/manifest.json",
  "/sw.js",
  "/login",
  "/register",
  "/change-password",
  "/tenant-not-found",
  "/restaurant-inactive",
  "/onboard",
];

function attachTenantHostLabel(requestHeaders: Headers, tenantKey: string) {
  requestHeaders.delete("x-tenant-host-label");
  requestHeaders.set("x-tenant-host-label", tenantKey);
}

function attachCustomHost(requestHeaders: Headers, hostname: string) {
  requestHeaders.delete("x-tenant-custom-host");
  requestHeaders.set("x-tenant-custom-host", hostname);
}

function withRequestHeaders(requestHeaders: Headers): { request: { headers: Headers } } {
  return { request: { headers: requestHeaders } };
}

function attachCorrelation(
  response: NextResponse,
  correlationId: string
): NextResponse {
  response.headers.set("x-correlation-id", correlationId);
  response.headers.set("x-request-id", correlationId);
  return response;
}

function isAuthCredentialPost(pathname: string, method: string): boolean {
  if (method !== "POST") return false;
  if (pathname === "/api/staff/login") return true;
  if (!pathname.startsWith("/api/auth")) return false;
  // Better Auth credential / recovery POSTs — avoid throttling session GETs.
  return (
    pathname.includes("sign-in") ||
    pathname.includes("sign-up") ||
    pathname.includes("forget-password") ||
    pathname.includes("reset-password") ||
    pathname.includes("send-verification") ||
    pathname.includes("change-password")
  );
}

async function applyAuthRateLimit(
  request: NextRequest,
  correlationId: string
): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;
  if (!isAuthCredentialPost(pathname, request.method)) return null;

  const ip = getClientIpFromHeaders(request.headers);
  const isStaffLogin = pathname === "/api/staff/login";
  const result = await checkSharedSlidingWindowLimit({
    key: `${isStaffLogin ? "staff-login" : "auth"}:${ip}`,
    limit: 5,
    windowMs: 60_000,
  });

  if (result.allowed) return null;

  const response = NextResponse.json(
    {
      message: "Too many login attempts. Please try again later.",
      correlationId,
    },
    { status: 429 }
  );
  response.headers.set("Retry-After", String(result.retryAfterSec));
  return attachCorrelation(response, correlationId);
}

function applyTenantPathRewrites(
  request: NextRequest,
  requestHeaders: Headers,
  correlationId: string
): NextResponse {
  const { pathname } = request.nextUrl;
  requestHeaders.set("x-url-pathname", pathname);
  requestHeaders.set("x-url-search", request.nextUrl.search);
  requestHeaders.set("x-correlation-id", correlationId);
  const url = request.nextUrl.clone();
  const reqInit = withRequestHeaders(requestHeaders);

  // API routes on tenant host always need tenant context headers
  if (pathname.startsWith("/api/")) {
    return attachCorrelation(NextResponse.next(reqInit), correlationId);
  }

  // /admin → Restaurant Owner Dashboard
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const rest = pathname.replace(/^\/admin/, "") || "";
    url.pathname = `/dashboard${rest}`;
    return attachCorrelation(NextResponse.rewrite(url, reqInit), correlationId);
  }

  // Legacy /dashboard paths on tenant host
  if (pathname.startsWith("/dashboard")) {
    return attachCorrelation(NextResponse.next(reqInit), correlationId);
  }

  // /staff → Staff Dashboard
  if (pathname === "/staff" || pathname.startsWith("/staff/")) {
    return attachCorrelation(NextResponse.next(reqInit), correlationId);
  }

  // /customer/table/{slug} → Customer QR Ordering
  const customerTableMatch = pathname.match(/^\/customer\/table\/([^/]+)(\/.*)?$/);
  if (customerTableMatch) {
    const tableSlug = customerTableMatch[1];
    const rest = customerTableMatch[2] || "";
    url.pathname = `/customer/table/${tableSlug}${rest}`;
    return attachCorrelation(NextResponse.rewrite(url, reqInit), correlationId);
  }

  // Legacy /customer/{token}
  const customerMatch = pathname.match(/^\/customer\/([^/]+)(\/.*)?$/);
  if (customerMatch) {
    const tableToken = customerMatch[1];
    const rest = customerMatch[2] || "";
    requestHeaders.set("x-table-token", tableToken);
    url.pathname = `/customer-order/${tableToken}${rest}`;
    return attachCorrelation(
      NextResponse.rewrite(url, withRequestHeaders(requestHeaders)),
      correlationId
    );
  }

  // Public QR menu
  if (pathname === "/" || pathname.startsWith("/menu")) {
    if (pathname === "/") {
      url.pathname = "/public-menu/menu";
    } else {
      url.pathname = `/public-menu${pathname}`;
    }
    return attachCorrelation(NextResponse.rewrite(url, reqInit), correlationId);
  }

  return attachCorrelation(NextResponse.next(reqInit), correlationId);
}

export async function middleware(request: NextRequest) {
  const correlationId =
    request.headers.get("x-correlation-id")?.trim() || crypto.randomUUID();
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") || "";

  const rateLimited = await applyAuthRateLimit(request, correlationId);
  if (rateLimited) return rateLimited;

  if (pathname.startsWith("/api/dev")) {
    if (process.env.NODE_ENV === "production") {
      return attachCorrelation(
        NextResponse.json({ error: "Not found", correlationId }, { status: 404 }),
        correlationId
      );
    }
    return attachCorrelation(NextResponse.next(), correlationId);
  }

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-correlation-id", correlationId);
    return attachCorrelation(
      NextResponse.next({ request: { headers: requestHeaders } }),
      correlationId
    );
  }

  const parsed = parseMiddlewareHostname(host);

  if (parsed.type === "platform") {
    const url = request.nextUrl.clone();
    if (!pathname.startsWith("/platform")) {
      url.pathname = `/platform${pathname === "/" ? "" : pathname}`;
      return attachCorrelation(NextResponse.rewrite(url), correlationId);
    }
    return attachCorrelation(NextResponse.next(), correlationId);
  }

  if (parsed.type === "tenant" && parsed.tenantKey) {
    const requestHeaders = new Headers(request.headers);
    attachTenantHostLabel(requestHeaders, parsed.tenantKey);
    return applyTenantPathRewrites(request, requestHeaders, correlationId);
  }

  // Custom cafe domain (e.g. homecafe.in) — same routes as tenant subdomain.
  // Tenant is resolved from Host in Node via customDomain (ACTIVE only).
  if (parsed.type === "custom" && parsed.hostname) {
    const requestHeaders = new Headers(request.headers);
    attachCustomHost(requestHeaders, parsed.hostname);
    return applyTenantPathRewrites(request, requestHeaders, correlationId);
  }

  return attachCorrelation(NextResponse.next(), correlationId);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
