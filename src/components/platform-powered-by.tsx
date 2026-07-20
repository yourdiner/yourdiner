import { AGENCY_NAME, AGENCY_URL, getPlatformBrand } from "@/lib/platform-brand";
import { cn } from "@/lib/utils";

/**
 * Renders "{brandName} by BluePeak Studio" where the agency name links to
 * bluepeakstudio.in. Async server component — reads the platform brand.
 */
export async function PlatformPoweredBy({ className }: { className?: string }) {
  const { brandName } = await getPlatformBrand();

  return (
    <p className={cn("text-center text-xs text-muted-foreground", className)}>
      <span className="font-medium">{brandName}</span>{" "}
      by{" "}
      <a
        href={AGENCY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium underline underline-offset-2 hover:text-foreground"
      >
        {AGENCY_NAME}
      </a>
    </p>
  );
}
