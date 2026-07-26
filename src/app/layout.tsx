import type { Metadata } from "next";
import { Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { DevTools } from "@/components/dev-tools/dev-tools";
import { DEFAULT_BRAND_NAME } from "@/lib/platform-brand-constants";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  weight: ["600", "700"],
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["400", "500", "600", "700"],
});

const DEFAULT_DESCRIPTION =
  "QR menus, staff ordering, kitchen display, reservations, billing and analytics — the complete restaurant operating system. Start your free trial today.";

function buildMetadata(brandName: string): Metadata {
  const title = `${brandName} — Restaurant Operating System`;
  const description = DEFAULT_DESCRIPTION.replace("restaurant operating system", `${brandName} restaurant operating system`);

  return {
    title: {
      default: title,
      template: `%s | ${brandName}`,
    },
    description,
    openGraph: {
      type: "website",
      locale: "en_IN",
      title,
      description,
      siteName: brandName,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const { getPlatformBrand } = await import("@/lib/platform-brand");
  try {
    const { brandName } = await getPlatformBrand();
    return buildMetadata(brandName);
  } catch {
    return buildMetadata(DEFAULT_BRAND_NAME);
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,300,0,0&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`${playfair.variable} ${jakarta.variable} font-body`}>
        <Providers>
          {children}
          <DevTools />
        </Providers>
      </body>
    </html>
  );
}
