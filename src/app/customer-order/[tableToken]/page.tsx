import { requireTenantPageContext } from "@/lib/tenancy";

export const dynamic = "force-dynamic";

export default async function LegacyCustomerOrderPage() {
  await requireTenantPageContext();

  return (
    <div className="flex min-h-screen items-center justify-center p-8 text-center">
      <div>
        <h1 className="text-xl font-bold">QR code updated</h1>
        <p className="mt-2 text-muted-foreground text-sm">
          This link is no longer valid. Please scan the updated QR code on your table to start
          ordering.
        </p>
      </div>
    </div>
  );
}
