import Link from "next/link";
import { PlatformSidebarServer } from "@/components/layout/platform-sidebar-server";
import { getAllPlansAdmin } from "@/features/subscriptions/platform-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { PlanActions } from "@/features/subscriptions/components/plan-actions";

export default async function PlansPage() {
  const plans = await getAllPlansAdmin();

  return (
    <div className="flex h-screen">
      <PlatformSidebarServer />
      <main className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-between border-b px-8 py-6">
          <div>
            <h1 className="text-2xl font-bold">Plans</h1>
            <p className="text-muted-foreground">Manage subscription plans, features, and pricing</p>
          </div>
          <Link href="/platform/plans/new">
            <Button>Create Plan</Button>
          </Link>
        </div>
        <div className="grid gap-6 p-8 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => {
            const version = plan.versions[0];
            const pricing = version?.pricing[0];
            const enabledFeatures = version?.planFeatures.filter((pf) => pf.enabled) ?? [];

            return (
              <Card key={plan.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle>{plan.name}</CardTitle>
                      <CardDescription>{plan.description}</CardDescription>
                    </div>
                    <Badge variant={plan.status === "ACTIVE" ? "default" : "secondary"}>
                      {plan.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <span className="text-2xl font-bold">
                      {formatCurrency(pricing?.priceMonthly ?? plan.priceMonthly)}
                    </span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  {version && (
                    <p className="text-xs text-muted-foreground">
                      Version {version.versionNumber} · {version.trialDays}d trial · {version.graceDays}d grace
                    </p>
                  )}
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {enabledFeatures.slice(0, 5).map((pf) => (
                      <li key={pf.id}>• {pf.feature.name}</li>
                    ))}
                    {enabledFeatures.length > 5 && (
                      <li>+ {enabledFeatures.length - 5} more</li>
                    )}
                  </ul>
                  <p className="text-xs text-muted-foreground">
                    {plan._count.subscriptions} active subscriptions
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/platform/plans/${plan.id}`}>
                      <Button size="sm" variant="outline">
                        Manage
                      </Button>
                    </Link>
                    <PlanActions planId={plan.id} status={plan.status} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
