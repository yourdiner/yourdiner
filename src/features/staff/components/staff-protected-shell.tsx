"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StaffLogoutButton } from "@/features/staff/components/staff-logout-button";

type Props = {
  restaurantName: string;
  staffName: string;
  staffRole: string;
  children: React.ReactNode;
};

export function StaffProtectedShell({
  restaurantName,
  staffName,
  staffRole,
  children,
}: Props) {
  const pathname = usePathname();
  const isOrderPage = pathname?.startsWith("/staff/order");

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      {!isOrderPage && (
        <header className="sticky top-0 z-10 border-b border-tertiary-fixed bg-surface/95 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
            <div>
              <p className="text-label-md font-semibold leading-none text-on-background">
                {restaurantName}
              </p>
              <p className="text-label-sm text-on-surface-variant">
                {staffName} · {staffRole}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/staff/floor">
                <Button variant="ghost" size="sm">
                  <LayoutGrid className="mr-1 h-4 w-4" />
                  Floor
                </Button>
              </Link>
              <StaffLogoutButton />
            </div>
          </div>
        </header>
      )}
      <main>{children}</main>
    </div>
  );
}
