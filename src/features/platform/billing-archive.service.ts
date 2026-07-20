import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/tenancy";

export async function listRestaurantArchives() {
  await requireSuperAdmin();
  return prisma.restaurantArchive.findMany({
    include: {
      permanentlyDeletedByUser: { select: { id: true, name: true, email: true } },
      _count: { select: { billingRecords: true } },
    },
    orderBy: { permanentlyDeletedAt: "desc" },
  });
}

export async function getRestaurantArchiveDetail(archiveId: string) {
  await requireSuperAdmin();
  const archive = await prisma.restaurantArchive.findUnique({
    where: { id: archiveId },
    include: {
      permanentlyDeletedByUser: { select: { id: true, name: true, email: true } },
      softDeletedByUser: { select: { id: true, name: true, email: true } },
      billingRecords: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!archive) return null;
  return archive;
}
