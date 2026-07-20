import { redirect } from "next/navigation";
import { getSession } from "@/lib/tenancy";
import { getMustChangePassword } from "@/features/auth/actions";
import { ChangePasswordForm } from "@/features/auth/components/change-password-form";

export default async function ChangePasswordPage() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }

  const mustChange = await getMustChangePassword(session.user.id);
  if (!mustChange) {
    redirect("/admin");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-4">
      <ChangePasswordForm />
    </div>
  );
}
