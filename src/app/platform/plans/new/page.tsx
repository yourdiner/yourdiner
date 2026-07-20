import Link from "next/link";
import { PlatformSidebarServer } from "@/components/layout/platform-sidebar-server";
import { getAllFeatures } from "@/features/subscriptions/platform-actions";
import { CreatePlanForm } from "@/features/subscriptions/components/create-plan-form";
import { Button } from "@/components/ui/button";

export default async function NewPlanPage() {
  const features = await getAllFeatures();

  return (
    <div className="flex h-screen">
      <PlatformSidebarServer />
      <main className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-between border-b px-8 py-6">
          <div>
            <h1 className="text-2xl font-bold">Create Plan</h1>
            <p className="text-muted-foreground">Add a new subscription plan</p>
          </div>
          <Link href="/platform/plans">
            <Button variant="outline">Back</Button>
          </Link>
        </div>
        <div className="p-8">
          <CreatePlanForm features={features} />
        </div>
      </main>
    </div>
  );
}
