import { redirect } from "next/navigation";
import { getSession } from "@/lib/tenancy";
import { getPostLoginRedirectUrl } from "@/features/auth/actions";
import { LoginForm } from "@/features/auth/components/login-form";

export default async function LoginPage() {
  const session = await getSession();
  if (session?.user) {
    try {
      redirect(await getPostLoginRedirectUrl());
    } catch {
      // Session exists but redirect resolution failed — show login form.
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <LoginForm />
    </div>
  );
}
