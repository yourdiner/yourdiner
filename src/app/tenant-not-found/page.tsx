import Link from "next/link";
import { getPlatformBrand } from "@/lib/platform-brand";

export default async function TenantNotFoundPage() {
  const { brandName } = await getPlatformBrand();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
      <h1 className="text-4xl font-bold">Restaurant Not Found</h1>
      <p className="mt-4 text-muted-foreground">
        This subdomain is not registered or the restaurant has been deactivated.
      </p>
      <Link href="/" className="mt-8 text-primary underline">
        Go to {brandName}
      </Link>
    </div>
  );
}
