import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/tenancy";

export default async function SubscriptionDetailRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    await requireSuperAdmin();
  } catch {
    notFound();
  }

  const subscription = await prisma.subscription.findUnique({
    where: { id },
    select: { restaurantId: true },
  });

  if (!subscription) notFound();

  redirect(`/platform/restaurants/${subscription.restaurantId}`);
}
