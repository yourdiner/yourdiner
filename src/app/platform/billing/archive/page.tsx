import Link from "next/link";
import { PlatformSidebarServer } from "@/components/layout/platform-sidebar-server";
import { listRestaurantArchives } from "@/features/platform/billing-archive.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";

export default async function BillingArchivePage() {
  const archives = await listRestaurantArchives();

  return (
    <div className="flex h-screen">
      <PlatformSidebarServer />
      <main className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-between border-b px-8 py-6">
          <div>
            <h1 className="text-2xl font-bold">Archived Billing</h1>
            <p className="text-muted-foreground">
              Billing history for permanently deleted restaurants
            </p>
          </div>
          <Link href="/platform/restaurants">
            <Button variant="outline">Back to Restaurants</Button>
          </Link>
        </div>
        <div className="p-8">
          <div className="rounded-xl border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="px-4 py-3 font-medium">Restaurant</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Deleted</th>
                  <th className="px-4 py-3 font-medium">Subscription</th>
                  <th className="px-4 py-3 font-medium">Records</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {archives.map((archive) => (
                  <tr key={archive.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium">{archive.name}</p>
                      <p className="text-xs text-muted-foreground">{archive.subdomain}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">Permanently Deleted</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <p>{formatDateTime(archive.permanentlyDeletedAt)}</p>
                      <p className="text-xs text-muted-foreground">
                        {archive.permanentlyDeletedByUser?.name ||
                          archive.permanentlyDeletedByUser?.email ||
                          "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3">{archive.subscriptionStatusAtDeletion || "—"}</td>
                    <td className="px-4 py-3">{archive._count.billingRecords}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/platform/billing/archive/${archive.id}`}
                        className="text-primary underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {archives.length === 0 && (
              <p className="p-8 text-center text-muted-foreground">No archived restaurants yet</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
