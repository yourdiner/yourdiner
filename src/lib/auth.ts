import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/db";
import { getRootDomain } from "@/lib/hostname";

const cookieDomain = process.env.COOKIE_DOMAIN;
const appUrl =
  process.env.BETTER_AUTH_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000";
// Browsers reject Domain=.localhost — only enable cross-subdomain cookies on real domains.
// Host-only cookies are required for custom cafe domains (homecafe.in) — leave COOKIE_DOMAIN
// unset if cafe admin login must work on those domains.
const useCrossSubDomainCookies = Boolean(
  cookieDomain && !cookieDomain.includes("localhost")
);

const rootHost = getRootDomain().split(":")[0];
const isLocalRoot = getRootDomain().includes("localhost");

export const auth = betterAuth({
  baseURL: appUrl,
  trustedOrigins: async (request) => {
    const origins: (string | undefined | null)[] = [
      appUrl,
      process.env.NEXT_PUBLIC_APP_URL || appUrl,
      "http://admin.localhost:3000",
      "http://*.localhost:3000",
      isLocalRoot ? undefined : `https://*.${rootHost}`,
      isLocalRoot ? undefined : `https://admin.${rootHost}`,
      isLocalRoot ? undefined : `http://*.${rootHost}`,
    ];

    const host = request?.headers.get("host");
    if (host) {
      const hostname = host.split(":")[0];
      origins.push(`https://${hostname}`, `http://${hostname}`);
      if (host.includes(":")) {
        origins.push(`http://${host}`, `https://${host}`);
      }
    }

    try {
      const { listActiveCustomDomainOrigins } = await import(
        "@/lib/custom-domain.service"
      );
      origins.push(...(await listActiveCustomDomainOrigins()));
    } catch {
      // DB may be unavailable during bootstrap
    }

    return origins.filter(Boolean) as string[];
  },
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  advanced: {
    ...(useCrossSubDomainCookies
      ? {
          crossSubDomainCookies: {
            enabled: true,
            domain: cookieDomain,
          },
        }
      : {}),
  },
  user: {
    additionalFields: {
      platformRole: {
        type: "string",
        required: false,
      },
      mustChangePassword: {
        type: "boolean",
        required: false,
        defaultValue: false,
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
