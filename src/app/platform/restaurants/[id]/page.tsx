import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformSidebarServer } from "@/components/layout/platform-sidebar-server";
import { getRestaurantPlatformDetail } from "@/features/restaurants/actions";
import { getAllPlansAdmin } from "@/features/subscriptions/platform-actions";
import { SubscriptionAdminActions } from "@/features/subscriptions/components/subscription-admin-actions";
import { SyncInvoicesButton } from "@/features/subscriptions/components/sync-invoices-button";
import {
  formatBillingAuditDetails,
  formatSubscriptionEventDetails,
  buildPlanNameMap,
} from "@/features/subscriptions/billing-metadata-formatter";
import { DnsInstructions } from "@/features/admin/components/dns-instructions";
import { RestaurantLifecycleActions } from "@/features/platform/components/restaurant-lifecycle-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildRestaurantUrl } from "@/lib/tenancy";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

export default async function RestaurantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let data;
  try {
    data = await getRestaurantPlatformDetail(id);
  } catch {
    notFound();
  }

  const { restaurant, auditLogs } = data;
  const subscription = restaurant.subscription;
  const [plans, planNames] = await Promise.all([getAllPlansAdmin(), buildPlanNameMap()]);

  const tenantKey = restaurant.subdomain;
  const restaurantUrls = {
    tenantKey,
    customDomain: restaurant.customDomain,
    customDomainStatus: restaurant.customDomainStatus,
  };
  const customerMenuUrl = buildRestaurantUrl(restaurantUrls, "/menu");
  const staffUrl = buildRestaurantUrl(restaurantUrls, "/staff/login");
  const adminUrl = buildRestaurantUrl(restaurantUrls, "/admin");

  const daysRemaining = subscription?.currentPeriodEnd
    ? Math.max(
        0,
        Math.ceil((subscription.currentPeriodEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      )
    : null;

  const planOptions = plans.map((p) => {
    const pricing = p.versions[0]?.pricing[0];
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      priceMonthly: pricing?.priceMonthly,
      priceYearly: pricing?.priceYearly,
    };
  });

  const owner = restaurant.staff.find((s) => s.role === "OWNER");

  return (
    <div className="flex h-screen">
      <PlatformSidebarServer />
      <main className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-between border-b px-8 py-6">
          <div>
            <h1 className="text-2xl font-bold">{restaurant.name}</h1>
            <p className="text-muted-foreground">{restaurant.subdomain}</p>
          </div>
          <Link href="/platform/restaurants">
            <Button variant="outline">Back to Restaurants</Button>
          </Link>
        </div>

        <div className="grid gap-6 p-8 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Restaurant Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Status</span>
                <Badge>{restaurant.status}</Badge>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Subdomain</span>
                <span>{restaurant.subdomain}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">UUID</span>
                <span className="font-mono text-xs">{restaurant.uuid}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Owner</span>
                <span>{owner?.user?.email || owner?.displayName || "—"}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Created</span>
                <span>{formatDate(restaurant.createdAt)}</span>
              </div>
              {restaurant.status === "DELETED" && restaurant.deletedAt && (
                <>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Deleted</span>
                    <span>{formatDateTime(restaurant.deletedAt)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Deleted by</span>
                    <span>
                      {restaurant.deletedByUser?.name ||
                        restaurant.deletedByUser?.email ||
                        "—"}
                    </span>
                  </div>
                  {restaurant.deleteReason && (
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Reason</span>
                      <span className="text-right">{restaurant.deleteReason}</span>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <RestaurantLifecycleActions
            restaurantId={restaurant.id}
            restaurantName={restaurant.name}
            status={restaurant.status}
          />

          <Card>
            <CardHeader>
              <CardTitle>Quick Links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {restaurant.status === "ACTIVE" ? (
                <>
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground">Customer Menu</span>
                    <a href={customerMenuUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">
                      {customerMenuUrl}
                    </a>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground">Staff Login</span>
                    <a href={staffUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">
                      {staffUrl}
                    </a>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground">Admin Dashboard</span>
                    <a href={adminUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">
                      {adminUrl}
                    </a>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">
                  Links are disabled while the restaurant is not active.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Usage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Categories</span>
                <span>{restaurant._count.categories}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Products</span>
                <span>{restaurant._count.products}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Orders</span>
                <span>{restaurant._count.orders}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customers</span>
                <span>{restaurant._count.customers}</span>
              </div>
            </CardContent>
          </Card>

          {subscription ? (
            <>
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Active Plan & Subscription</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Plan</p>
                    <p className="font-medium">
                      {subscription.plan.name}
                      {subscription.planVersion && ` (v${subscription.planVersion.versionNumber})`}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge>
                      {subscription.pendingUpgradePlanId && subscription.pendingCheckout
                        ? "Upgrade Pending Payment"
                        : subscription.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Billing cycle</p>
                    <p className="font-medium">{subscription.billingCycle}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Auto Debit</p>
                    <p className="font-medium">{subscription.autoDebitEnabled ? "Enabled" : "Disabled"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Mandate</p>
                    <p className="font-medium">{subscription.mandateStatus}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Price Paid</p>
                    <p className="font-medium">{formatCurrency(subscription.pricePaid)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Payment Status</p>
                    <p className="font-medium">{subscription.paymentStatus}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Period End</p>
                    <p className="font-medium">
                      {formatDate(subscription.currentPeriodEnd)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Next Payment</p>
                    <p className="font-medium">
                      {formatDate(subscription.nextPaymentAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Days Remaining</p>
                    <p className="font-medium">{daysRemaining ?? "—"}</p>
                  </div>
                  {subscription.trialEndsAt && (
                    <div>
                      <p className="text-sm text-muted-foreground">Trial Ends</p>
                      <p className="font-medium">
                        {formatDate(subscription.trialEndsAt)}
                      </p>
                    </div>
                  )}
                  {subscription.gracePeriodEndsAt && (
                    <div>
                      <p className="text-sm text-muted-foreground">Grace Period Ends</p>
                      <p className="font-medium">
                        {formatDate(subscription.gracePeriodEndsAt)}
                      </p>
                    </div>
                  )}
                  {subscription.pendingUpgradePlanId && subscription.pendingCheckout && (
                    <div className="sm:col-span-2">
                      <p className="text-sm text-muted-foreground">Pending upgrade</p>
                      <p className="font-medium">
                        {planNames[subscription.pendingUpgradePlanId] ?? "New plan"}
                        {subscription.pendingUpgradeAmount != null &&
                          ` — ${formatCurrency(subscription.pendingUpgradeAmount)}`}
                      </p>
                      {subscription.pendingCheckoutUrl && (
                        <a
                          href={subscription.pendingCheckoutUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary underline"
                        >
                          Open checkout link
                        </a>
                      )}
                    </div>
                  )}
                  {subscription.scheduledPlan && (
                    <div className="sm:col-span-2">
                      <p className="text-sm text-muted-foreground">Scheduled Change</p>
                      <p className="font-medium">
                        Downgrade to {subscription.scheduledPlan.name}
                        {subscription.scheduledChangeAt &&
                          ` on ${formatDate(subscription.scheduledChangeAt)}`}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Subscription Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <SubscriptionAdminActions
                    subscriptionId={subscription.id}
                    status={subscription.status}
                    plans={planOptions}
                    currentPlanId={subscription.planId}
                    currentPlanName={subscription.plan.name}
                    currentPeriodStart={subscription.currentPeriodStart}
                    currentPeriodEnd={subscription.currentPeriodEnd}
                    billingCycle={subscription.billingCycle}
                    pendingUpgradePlanId={subscription.pendingUpgradePlanId}
                    pendingCheckout={subscription.pendingCheckout}
                    pendingUpgradeAmount={subscription.pendingUpgradeAmount}
                    pendingUpgradePlanName={
                      subscription.pendingUpgradePlanId
                        ? planNames[subscription.pendingUpgradePlanId]
                        : null
                    }
                  />
                </CardContent>
              </Card>

              <Card className="lg:col-span-3">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Payments & Invoices</CardTitle>
                  <SyncInvoicesButton subscriptionId={subscription.id} />
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-2">
                  <div>
                    <h3 className="mb-2 font-medium">Payments</h3>
                    {subscription.payments.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No payments yet</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left">
                            <th className="pb-2">Date</th>
                            <th className="pb-2">Amount</th>
                            <th className="pb-2">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {subscription.payments.map((p) => (
                            <tr key={p.id} className="border-b">
                              <td className="py-2">{formatDate(p.createdAt)}</td>
                              <td className="py-2">{formatCurrency(p.amount)}</td>
                              <td className="py-2">{p.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                  <div>
                    <h3 className="mb-2 font-medium">Invoices</h3>
                    {subscription.invoices.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No invoices yet</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left">
                            <th className="pb-2">Date</th>
                            <th className="pb-2">Amount</th>
                            <th className="pb-2">Status</th>
                            <th className="pb-2">Download</th>
                          </tr>
                        </thead>
                        <tbody>
                          {subscription.invoices.map((inv) => (
                            <tr key={inv.id} className="border-b">
                              <td className="py-2">{formatDate(inv.createdAt)}</td>
                              <td className="py-2">{formatCurrency(inv.amount)}</td>
                              <td className="py-2">{inv.status}</td>
                              <td className="py-2">
                                {inv.invoiceUrl ? (
                                  <a
                                    href={inv.invoiceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary underline"
                                  >
                                    PDF
                                  </a>
                                ) : (
                                  "—"
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle>Renewal History</CardTitle>
                </CardHeader>
                <CardContent>
                  {subscription.events.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No renewal events yet</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-2">Date</th>
                          <th className="pb-2">Event</th>
                          <th className="pb-2">Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subscription.events.map((event) => (
                          <tr key={event.id} className="border-b">
                            <td className="py-2 whitespace-nowrap">{formatDateTime(event.createdAt)}</td>
                            <td className="py-2">{event.type}</td>
                            <td className="py-2 text-muted-foreground">
                              {formatSubscriptionEventDetails(event.type, event.metadata, planNames)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle>Billing Audit Log</CardTitle>
                </CardHeader>
                <CardContent>
                  {auditLogs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No billing audit entries yet</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-2">Date</th>
                          <th className="pb-2">Action</th>
                          <th className="pb-2">Entity</th>
                          <th className="pb-2">Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs.map((log) => (
                          <tr key={log.id} className="border-b">
                            <td className="py-2 whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                            <td className="py-2">{log.action}</td>
                            <td className="py-2">{log.entityType}</td>
                            <td className="py-2 text-muted-foreground">
                              {formatBillingAuditDetails(log.action, log.metadata, planNames)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Subscription</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">No active subscription for this restaurant.</p>
              </CardContent>
            </Card>
          )}

          <DnsInstructions
            subdomain={restaurant.subdomain}
            uuid={restaurant.uuid}
            customDomain={restaurant.customDomain}
            customDomainStatus={restaurant.customDomainStatus}
            rootDomain={process.env.NEXT_PUBLIC_ROOT_DOMAIN?.split(":")[0]}
          />
        </div>
      </main>
    </div>
  );
}
