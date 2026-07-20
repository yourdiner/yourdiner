import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformSidebarServer } from "@/components/layout/platform-sidebar-server";
import { getRestaurantArchiveDetail } from "@/features/platform/billing-archive.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export default async function BillingArchiveDetailPage({
  params,
}: {
  params: Promise<{ archiveId: string }>;
}) {
  const { archiveId } = await params;
  const archive = await getRestaurantArchiveDetail(archiveId);
  if (!archive) notFound();

  const invoices = archive.billingRecords.filter((r) => r.recordType === "INVOICE");
  const payments = archive.billingRecords.filter((r) => r.recordType === "PAYMENT");
  const subscriptionRecords = archive.billingRecords.filter(
    (r) => r.recordType === "SUBSCRIPTION"
  );

  return (
    <div className="flex h-screen">
      <PlatformSidebarServer />
      <main className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-between border-b px-8 py-6">
          <div>
            <h1 className="text-2xl font-bold">{archive.name}</h1>
            <p className="text-muted-foreground">Archived billing records</p>
          </div>
          <Link href="/platform/billing/archive">
            <Button variant="outline">Back to Archive</Button>
          </Link>
        </div>

        <div className="grid gap-6 p-8 lg:grid-cols-3">
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Restaurant Summary</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              <div>
                <p className="text-muted-foreground">Status</p>
                <Badge variant="secondary">Permanently Deleted</Badge>
              </div>
              <div>
                <p className="text-muted-foreground">Deleted on</p>
                <p>{formatDateTime(archive.permanentlyDeletedAt)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Deleted by</p>
                <p>
                  {archive.permanentlyDeletedByUser?.name ||
                    archive.permanentlyDeletedByUser?.email ||
                    "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Subscription at deletion</p>
                <p>{archive.subscriptionStatusAtDeletion || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Orders (purged)</p>
                <p>{archive.orderCount}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Customers (purged)</p>
                <p>{archive.customerCount}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Invoices retained</p>
                <p>{archive.invoiceCount}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Payments retained</p>
                <p>{archive.paymentCount}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Subscription History</CardTitle>
            </CardHeader>
            <CardContent>
              {subscriptionRecords.length === 0 ? (
                <p className="text-sm text-muted-foreground">No subscription snapshot</p>
              ) : (
                <p className="text-sm">
                  Razorpay subscription: {archive.razorpaySubscriptionId || "—"}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <p className="text-sm text-muted-foreground">No invoices archived</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2">Date</th>
                      <th className="pb-2">Number</th>
                      <th className="pb-2">Amount</th>
                      <th className="pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => (
                      <tr key={invoice.id} className="border-b">
                        <td className="py-2">{invoice.paidAt ? formatDateTime(invoice.paidAt) : "—"}</td>
                        <td className="py-2">{invoice.invoiceNumber || "—"}</td>
                        <td className="py-2">
                          {invoice.amount != null ? formatCurrency(invoice.amount) : "—"}
                        </td>
                        <td className="py-2">{invoice.status || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Payments</CardTitle>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments archived</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2">Date</th>
                      <th className="pb-2">Amount</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2">Razorpay ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => (
                      <tr key={payment.id} className="border-b">
                        <td className="py-2">
                          {payment.paidAt ? formatDateTime(payment.paidAt) : "—"}
                        </td>
                        <td className="py-2">
                          {payment.amount != null ? formatCurrency(payment.amount) : "—"}
                        </td>
                        <td className="py-2">{payment.status || "—"}</td>
                        <td className="py-2 font-mono text-xs">
                          {payment.razorpayPaymentId || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
