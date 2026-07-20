import { getPlatformBrand } from "@/lib/platform-brand";
import { PlatformSidebar } from "./platform-sidebar";

/** Server wrapper that injects the current platform brand name into the sidebar. */
export async function PlatformSidebarServer() {
  const { brandName } = await getPlatformBrand();
  return <PlatformSidebar brandName={brandName} />;
}
