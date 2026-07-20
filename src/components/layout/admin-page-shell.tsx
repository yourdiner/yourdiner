import { DashboardHeader } from "@/components/layout/dashboard-header";
import { requireTenantPageContext } from "@/lib/tenancy";
import { prisma } from "@/lib/db";

interface AdminPageShellProps {
  title: string;
  searchPlaceholder?: string;
  showSearch?: boolean;
  children: React.ReactNode;
}

export async function AdminPageShell({
  title,
  searchPlaceholder,
  showSearch,
  children,
}: AdminPageShellProps) {
  let notifications: Array<{ id: string; title: string; body: string; createdAt: string }> = [];

  try {
    const tenant = await requireTenantPageContext();
    const rows = await prisma.notification.findMany({
      where: { restaurantId: tenant.restaurantId, isRead: false },
      select: { id: true, title: true, body: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    notifications = rows.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      createdAt: n.createdAt.toISOString(),
    }));
  } catch {
    // Tenant context unavailable — skip notifications
  }

  return (
    <>
      <DashboardHeader
        title={title}
        searchPlaceholder={searchPlaceholder}
        showSearch={showSearch}
        notifications={notifications}
      />
      <div className="px-margin-mobile py-3 md:px-margin-desktop md:py-4">{children}</div>
    </>
  );
}
