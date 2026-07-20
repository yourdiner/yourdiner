"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Settings,
  LogOut,
  Utensils,
  Archive,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

const navItems = [
  { href: "/platform", label: "Dashboard", icon: LayoutDashboard },
  { href: "/platform/restaurants", label: "Restaurants", icon: Building2 },
  { href: "/platform/billing/archive", label: "Archived Billing", icon: Archive },
  { href: "/platform/plans", label: "Plans", icon: CreditCard },
  { href: "/platform/settings", label: "Settings", icon: Settings },
];

export function PlatformSidebar({ brandName = "Restaurant OS" }: { brandName?: string }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await authClient.signOut();
    router.push("/login");
  };

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <Utensils className="h-5 w-5" />
        <span className="truncate font-semibold">{brandName}</span>
        <span className="ml-auto text-xs text-muted-foreground">Admin</span>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/platform" && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}>
              <span
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-4 space-y-2">
        <ThemeToggle />
        <Button variant="ghost" className="w-full justify-start" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
