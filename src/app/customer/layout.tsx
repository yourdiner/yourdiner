import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { requireTenantPageContext } from "@/lib/tenancy";
import { getPublicBranding } from "@/features/branding/actions";
import { PlatformPoweredBy } from "@/components/platform-powered-by";
import "@/features/menu/components/public-menu.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
});

export async function generateMetadata(): Promise<Metadata> {
  try {
    const tenant = await requireTenantPageContext({ skipPreferredHostRedirect: true });
    const branding = await getPublicBranding(tenant.restaurantId);

    return {
      title: `${tenant.name} - Table Order`,
      description: branding?.about || `Order from ${tenant.name}`,
      icons: branding?.favicon?.url ? [{ url: branding.favicon.url }] : undefined,
      manifest: "/manifest.json",
      appleWebApp: {
        capable: true,
        statusBarStyle: "default",
        title: tenant.name,
      },
    };
  } catch {
    return { title: "Table Order" };
  }
}

export async function generateViewport(): Promise<Viewport> {
  try {
    const tenant = await requireTenantPageContext({ skipPreferredHostRedirect: true });
    const branding = await getPublicBranding(tenant.restaurantId);
    return {
      themeColor: branding?.primaryColor || "#425646",
      width: "device-width",
      initialScale: 1,
      maximumScale: 5,
    };
  } catch {
    return {
      themeColor: "#425646",
      width: "device-width",
      initialScale: 1,
      maximumScale: 5,
    };
  }
}

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`public-menu-root ${jakarta.variable}`}>
      {children}
      <div className="border-t border-[var(--pm-outline-variant)] bg-[var(--pm-surface-container-lowest)] px-4 py-4 pb-24 lg:pb-4">
        <PlatformPoweredBy className="text-[var(--pm-on-surface-variant)]" />
      </div>
    </div>
  );
}
