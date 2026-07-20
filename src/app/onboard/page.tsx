import type { Metadata } from "next";
import { getRootDomain } from "@/lib/hostname";
import { getPlatformBrand } from "@/lib/platform-brand";
import { OnboardingForm } from "@/features/onboarding/components/onboarding-form";
import { PlatformPoweredBy } from "@/components/platform-powered-by";
import { Utensils } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { brandName } = await getPlatformBrand();
  return {
    title: `Get started with ${brandName}`,
    description: "Onboard your restaurant and start your free trial.",
  };
}

export default async function OnboardPage() {
  const { brandName } = await getPlatformBrand();
  const rootDomain = getRootDomain();

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="border-b bg-background">
        <div className="container mx-auto flex h-16 items-center gap-2 px-4 text-xl font-semibold">
          <Utensils className="h-6 w-6" />
          {brandName}
        </div>
      </header>

      <main className="container mx-auto flex-1 px-4 py-10">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <h1 className="text-3xl font-bold sm:text-4xl">Bring your restaurant online</h1>
          <p className="mt-3 text-muted-foreground">
            Set up your digital menu, staff ordering, and more. Fill in the details below and your
            account will be created automatically.
          </p>
        </div>
        <OnboardingForm rootDomain={rootDomain} />
      </main>

      <footer className="border-t bg-background py-6">
        <PlatformPoweredBy />
      </footer>
    </div>
  );
}
