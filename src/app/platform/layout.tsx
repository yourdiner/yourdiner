import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/tenancy";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let session;
  try {
    session = await requireSuperAdmin();
  } catch {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { mustChangePassword: true },
  });
  if (user?.mustChangePassword) {
    redirect("/change-password");
  }

  return <>{children}</>;
}
