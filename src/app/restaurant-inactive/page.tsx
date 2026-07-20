import { requireTenantPageContext } from "@/lib/tenancy";
import { getPlatformBrand } from "@/lib/platform-brand";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ status?: string }>;

export default async function RestaurantInactivePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const tenant = await requireTenantPageContext();
  const params = await searchParams;
  const status = params.status ?? tenant.restaurantStatus;
  const { brandName } = await getPlatformBrand();

  const title =
    status === "DELETED"
      ? "Restaurant no longer active"
      : status === "SUSPENDED"
        ? "Restaurant suspended"
        : "Restaurant unavailable";

  const message =
    status === "DELETED"
      ? "This restaurant is no longer active."
      : status === "SUSPENDED"
        ? "This restaurant has been suspended."
        : "This restaurant is currently unavailable.";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="mt-4 max-w-md text-muted-foreground">{message}</p>
      <p className="mt-2 text-sm text-muted-foreground">{tenant.name}</p>
      <p className="mt-8 text-sm text-muted-foreground">
        Contact {brandName} support if you believe this is an error.
      </p>
    </div>
  );
}
