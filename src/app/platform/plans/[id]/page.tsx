import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformSidebarServer } from "@/components/layout/platform-sidebar-server";
import { getPlanDetail, getAllFeatures } from "@/features/subscriptions/platform-actions";
import { PlanEditor } from "@/features/subscriptions/components/plan-editor";
import { PlanVersionHistory } from "@/features/subscriptions/components/plan-version-history";
import { Button } from "@/components/ui/button";

export default async function PlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [plan, features] = await Promise.all([getPlanDetail(id), getAllFeatures()]);
  if (!plan) notFound();

  return (
    <div className="flex h-screen">
      <PlatformSidebarServer />
      <main className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-between border-b px-8 py-6">
          <div>
            <h1 className="text-2xl font-bold">{plan.name}</h1>
            <p className="text-muted-foreground">Edit plan features, pricing, and settings</p>
          </div>
          <Link href="/platform/plans">
            <Button variant="outline">Back to Plans</Button>
          </Link>
        </div>
        <div className="space-y-8 p-8">
          <PlanEditor plan={plan} features={features} />
          <PlanVersionHistory versions={plan.versions} />
        </div>
      </main>
    </div>
  );
}
