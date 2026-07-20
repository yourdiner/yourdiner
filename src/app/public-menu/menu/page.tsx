import { requireTenantPageContext } from "@/lib/tenancy";
import { getPublicMenu } from "@/features/menu/actions";
import { PublicMenuView } from "@/features/menu/components/public-menu-view";
import { canShowPublicMenu } from "@/lib/public-menu-access";
import { restaurantHasCustomerOrdering } from "@/lib/customer-order-service";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * General Customer QR — browse-only menu.
 * Never enables cart/ordering; table QR is required to place orders on premium.
 */
export default async function PublicMenuPage() {
  const tenant = await requireTenantPageContext();
  const menuData = await getPublicMenu(tenant.restaurantId);

  if (!menuData) notFound();

  if (!canShowPublicMenu({
    status: menuData.restaurant.status ?? "ACTIVE",
    subscription: (menuData.restaurant.subscription ?? null) as Parameters<
      typeof canShowPublicMenu
    >[0]["subscription"],
  })) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center">
        <div className="w-full max-w-md rounded-[var(--pm-radius-xl)] border border-[var(--pm-outline-variant)] bg-[var(--pm-surface-container-lowest)] px-6 py-10 shadow-[var(--pm-shadow-sm)]">
          <h1 className="font-display text-xl text-[var(--pm-on-surface)]">{menuData.restaurant.name}</h1>
          <p className="mt-3 text-sm leading-relaxed text-[var(--pm-on-surface-variant)]">
            This menu is temporarily unavailable. Please check back later.
          </p>
        </div>
      </div>
    );
  }

  const hasTableOrdering = await restaurantHasCustomerOrdering(tenant.restaurantId);

  return (
    <>
      {hasTableOrdering && (
        <div className="pm-browse-banner">
          This is a view-only menu. To place an order, scan the QR code on your table.
        </div>
      )}
      <PublicMenuView
        menu={menuData as Parameters<typeof PublicMenuView>[0]["menu"]}
        mode="browse"
      />
    </>
  );
}
