import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/tenancy";

export const dynamic = "force-dynamic";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireSuperAdmin();
  } catch {
    redirect("/login");
  }

  return <>{children}</>;
}
