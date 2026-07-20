import type { NextConfig } from "next";
import path from "path";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const disableWebpackCache =
  process.env.NODE_ENV === "development" &&
  process.platform === "win32" &&
  process.env.WEBPACK_CACHE !== "1";

function buildServerActionAllowedOrigins(): string[] {
  const origins = new Set<string>([
    "*.localhost:3000",
    "admin.localhost:3000",
    "localhost:3000",
  ]);

  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim();
  if (root) {
    origins.add(root);
    const hostOnly = root.split(":")[0];
    if (hostOnly) {
      origins.add(hostOnly);
      if (hostOnly !== "localhost") {
        origins.add(`*.${hostOnly}`);
        origins.add(`admin.${hostOnly}`);
      }
    }
  }

  for (const raw of [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.BETTER_AUTH_URL,
  ]) {
    if (!raw?.trim()) continue;
    try {
      origins.add(new URL(raw).host);
    } catch {
      /* ignore invalid URL */
    }
  }

  for (const part of (process.env.SERVER_ACTION_ALLOWED_ORIGINS ?? "").split(",")) {
    const trimmed = part.trim();
    if (trimmed) origins.add(trimmed);
  }

  return [...origins];
}

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https://res.cloudinary.com https://*.cloudinary.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com https://checkout.razorpay.com https://*.cloudinary.com https://fonts.googleapis.com https://fonts.gstatic.com",
      "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  serverExternalPackages: ["@prisma/client", "prisma"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "**.cloudinary.com" },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
      // Tenant subdomains send a different Origin than Host.
      allowedOrigins: buildServerActionAllowedOrigins(),
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  output: "standalone",
  webpack: (config, { dev }) => {
    // Windows dev: persistent pack cache can race and corrupt .next (ENOENT on rename).
    if (dev && disableWebpackCache) {
      config.cache = false;
    }
    return config;
  },
};

export default withBundleAnalyzer(nextConfig);
