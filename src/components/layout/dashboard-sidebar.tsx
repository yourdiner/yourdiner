"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { MaterialIcon } from "@/components/layout/material-icon";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { moduleHasFeature, getModuleUpgradeLabel } from "@/lib/subscription/feature-registry";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  module?: string;
  /** Opens outside the admin app (staff POS, public menu, etc.) */
  external?: boolean;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    title: "Overview",
    items: [{ href: "/admin", label: "Dashboard", icon: "dashboard" }],
  },
  {
    title: "Operations",
    items: [
      { href: "/admin/orders", label: "Floor & Orders", icon: "receipt_long", module: "orders" },
      { href: "/admin/reservations", label: "Reservations", icon: "event_seat", module: "reservations" },
      { href: "/admin/kitchen", label: "Kitchen", icon: "soup_kitchen", module: "kitchen" },
      { href: "/admin/tables", label: "Tables", icon: "table_restaurant", module: "tables" },
    ],
  },
  {
    title: "Menu",
    items: [
      { href: "/admin/products", label: "Menu", icon: "restaurant_menu", module: "products" },
      { href: "/admin/categories", label: "Categories", icon: "folder_open", module: "categories" },
    ],
  },
  {
    title: "People",
    items: [
      { href: "/admin/waiters", label: "Team", icon: "group", module: "staff" },
      { href: "/admin/customers", label: "Customers", icon: "person", module: "customers" },
    ],
  },
  {
    title: "Marketing",
    items: [{ href: "/admin/qr-codes", label: "QR Codes", icon: "qr_code_2", module: "qr_codes" }],
  },
  {
    title: "Insights",
    items: [
      { href: "/admin/analytics", label: "Analytics", icon: "analytics", module: "analytics" },
    ],
  },
  {
    title: "Account",
    items: [
      { href: "/admin/subscription", label: "Billing", icon: "credit_card" },
      { href: "/admin/settings", label: "Settings", icon: "settings" },
    ],
  },
];

interface DashboardSidebarProps {
  restaurantName: string;
  enabledFeatures: string[];
  planName: string;
  logoUrl?: string | null;
}

export function DashboardSidebar({
  restaurantName,
  enabledFeatures,
  planName,
  logoUrl,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const featureSet = new Set(enabledFeatures);

  const isModuleAvailable = (module?: string) => {
    if (!module) return true;
    return moduleHasFeature(featureSet, module);
  };

  const isActive = (href: string) => {
    const normalizedPath = pathname.replace("/dashboard", "/admin");
    if (href === "/admin") {
      return normalizedPath === "/admin" || normalizedPath === "/dashboard";
    }
    return normalizedPath === href || normalizedPath.startsWith(`${href}/`);
  };

  const handleLogout = async () => {
    await authClient.signOut();
    router.push("/login");
  };

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center gap-3 border-b px-6">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-8 w-8 rounded object-cover" />
        ) : null}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{restaurantName}</p>
          <p className="truncate text-xs text-muted-foreground">{planName} plan</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-4">
        {navSections.map((section) => (
          <div key={section.title} className="mb-6">
            <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {section.title}
            </p>
            <ul className="space-y-1">
              {section.items.map((item) => {
                const available = isModuleAvailable(item.module);
                const active = isActive(item.href);

                if (!available && item.module) {
                  return (
                    <li key={item.href}>
                      <div
                        className={cn(
                          "flex items-center justify-between rounded-lg px-3 py-2 text-sm text-muted-foreground/60"
                        )}
                      >
                        <span className="flex items-center gap-3">
                          <MaterialIcon name={item.icon} className="text-lg opacity-50" />
                          {item.label}
                        </span>
                        <Badge variant="secondary" className="text-[10px]">
                          {getModuleUpgradeLabel(item.module)}
                        </Badge>
                      </div>
                    </li>
                  );
                }

                return (
                  <li key={item.href}>
                    {item.external ? (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                          "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <MaterialIcon name={item.icon} className="text-lg" />
                        <span className="flex-1">{item.label}</span>
                        <MaterialIcon name="open_in_new" className="text-sm opacity-60" />
                      </a>
                    ) : (
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                          active
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <MaterialIcon name={item.icon} className="text-lg" />
                        {item.label}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t p-4">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <MaterialIcon name="logout" className="text-lg" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
