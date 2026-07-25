"use client";

import {
  Hand,
  ShoppingBag,
  Receipt,
  Utensils,
  Bell,
  X,
  Loader2,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import {
  formatKitchenStatusLabel,
  kitchenStatusBadgeClass,
} from "@/lib/kitchen-status-label";
import type { MenuViewMode, OrderPanel } from "@/features/menu/components/public-menu-types";

type Props = {
  mode: MenuViewMode;
  canOrder: boolean;
  cartCount: number;
  /** Badge on Order tab; defaults to cartCount */
  orderBadgeCount?: number;
  cartTotal: number;
  cartSummary: string;
  activePanel: OrderPanel;
  onActivePanelChange: (panel: OrderPanel) => void;
  onCartOpen: () => void;
  onCartClose: () => void;
  cartOpen: boolean;
  orderPlaced: boolean;
  onDismissOrderPlaced: () => void;
  customerName?: string;
  showOrderOverlay: boolean;
  showServiceOverlay: boolean;
  showBillOverlay: boolean;
  submitting: boolean;
  callingWaiter: boolean;
  actionLoading: boolean;
  billRequested: boolean;
  onCallWaiter: () => void;
  onRequestBill: () => void;
  activeOrderTotal?: number;
  trackingItems?: Array<{
    id: string;
    name: string;
    billDisplayName?: string | null;
    quantity: number;
    kitchenStatus: string;
  }>;
  orderPanel: React.ReactNode;
};

export function PublicMenuOrderChrome({
  mode,
  canOrder,
  cartCount,
  orderBadgeCount,
  cartTotal,
  cartSummary,
  activePanel,
  onActivePanelChange,
  onCartOpen,
  onCartClose,
  cartOpen,
  orderPlaced,
  onDismissOrderPlaced,
  customerName,
  showOrderOverlay,
  showServiceOverlay,
  showBillOverlay,
  submitting,
  callingWaiter,
  actionLoading,
  billRequested,
  onCallWaiter,
  onRequestBill,
  activeOrderTotal,
  trackingItems,
  orderPanel,
}: Props) {
  const tabBadgeCount = orderBadgeCount ?? cartCount;
  const mobileNavClass = (panel: OrderPanel) =>
    `pm-press flex cursor-pointer flex-col items-center gap-1 px-3 py-1 ${
      activePanel === panel
        ? "text-[var(--pm-primary)]"
        : "text-[var(--pm-on-surface-variant)]"
    }`;

  return (
    <>
      {canOrder && mode === "customer" && cartCount > 0 && activePanel === "menu" && (
        <div className="fixed bottom-[4.75rem] left-[var(--pm-margin-mobile)] right-[var(--pm-margin-mobile)] z-[60] md:bottom-6 md:left-1/2 md:right-auto md:w-full md:max-w-xl md:-translate-x-1/2 lg:bottom-6">
          <div className="pm-cart-bar flex items-center justify-between gap-3 p-3 sm:p-3.5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--pm-radius-md)] bg-white/12">
                <ShoppingBag className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold tracking-tight">
                  {cartCount} item{cartCount !== 1 ? "s" : ""}
                </p>
                <p className="truncate text-xs text-white/75">{cartSummary}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <p className="hidden text-sm font-semibold tabular-nums sm:block">
                {formatCurrency(cartTotal)}
              </p>
              <button
                type="button"
                onClick={() => {
                  onActivePanelChange("order");
                  onCartOpen();
                }}
                className="pm-press rounded-[var(--pm-radius-md)] bg-white px-3.5 py-2 text-sm font-semibold text-[var(--pm-primary)] sm:px-4"
              >
                Review
              </button>
            </div>
          </div>
        </div>
      )}

      {canOrder && (
        <nav className="pm-mobile-tabbar fixed bottom-0 left-0 right-0 z-50 flex justify-around py-2.5 md:hidden">
          <button type="button" className={mobileNavClass("menu")} onClick={() => onActivePanelChange("menu")}>
            <Utensils className="h-5 w-5" />
            <span className="text-[10px] font-semibold">Menu</span>
          </button>
          {mode === "customer" && (
            <button type="button" className={mobileNavClass("service")} onClick={() => onActivePanelChange("service")}>
              <Hand className="h-5 w-5" />
              <span className="text-[10px] font-medium">Service</span>
            </button>
          )}
          <button type="button" className={mobileNavClass("order")} onClick={() => onActivePanelChange("order")}>
            <span className="relative">
              <ShoppingBag className="h-5 w-5" />
              {tabBadgeCount > 0 && mode === "customer" && (
                <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--pm-secondary)] px-1 text-[9px] font-bold text-white">
                  {tabBadgeCount}
                </span>
              )}
            </span>
            <span className="text-[10px] font-medium">Order</span>
          </button>
          <button type="button" className={mobileNavClass("bill")} onClick={() => onActivePanelChange("bill")}>
            <Receipt className="h-5 w-5" />
            <span className="text-[10px] font-medium">Bill</span>
          </button>
        </nav>
      )}

      {orderPlaced && (
        <div className="fixed left-4 right-4 top-[4.5rem] z-[65] rounded-[var(--pm-radius-lg)] border border-emerald-200/80 bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-900 shadow-[var(--pm-shadow-sm)] md:left-1/2 md:right-auto md:w-full md:max-w-lg md:-translate-x-1/2">
          Your order has been sent to the kitchen. You can add more items anytime.
          <button
            type="button"
            className="ml-2 font-medium underline underline-offset-2"
            onClick={onDismissOrderPlaced}
          >
            Dismiss
          </button>
        </div>
      )}

      {customerName && mode === "customer" && (
        <p className="sr-only">Ordering as {customerName}</p>
      )}

      {(showOrderOverlay || cartOpen) && (
        <div
          className="pm-overlay"
          onClick={() => {
            if (!submitting) {
              onCartClose();
              if (activePanel === "order") onActivePanelChange("menu");
            }
          }}
        >
          <div className="pm-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--pm-outline-variant)] bg-[var(--pm-surface-container-lowest)] px-4 py-3.5">
              <h2 className="font-display text-lg text-[var(--pm-on-surface)]">
                {mode === "staff" ? "Table Order" : "Your Order"}
              </h2>
              <button
                type="button"
                className="pm-icon-btn"
                onClick={() => {
                  onCartClose();
                  onActivePanelChange("menu");
                }}
                disabled={submitting}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {orderPanel}
          </div>
        </div>
      )}

      {showServiceOverlay && (
        <div className="pm-overlay" onClick={() => onActivePanelChange("menu")}>
          <div className="pm-sheet p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display mb-2 text-lg text-[var(--pm-on-surface)]">Need assistance?</h2>
            <p className="mb-6 text-sm leading-relaxed text-[var(--pm-on-surface-variant)]">
              Tap below and a waiter will come to your table shortly.
            </p>
            {mode === "customer" ? (
              <button
                type="button"
                disabled={callingWaiter}
                onClick={() => void onCallWaiter()}
                className="pm-btn-primary w-full py-3"
              >
                {callingWaiter ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Bell className="h-4 w-4" />
                )}
                Call Waiter
              </button>
            ) : (
              <p className="text-sm text-[var(--pm-on-surface-variant)]">
                Use the order panel to manage this table&apos;s service.
              </p>
            )}
            <button
              type="button"
              onClick={() => onActivePanelChange("menu")}
              className="pm-press mt-3 w-full py-2.5 text-sm text-[var(--pm-on-surface-variant)]"
            >
              Back to menu
            </button>
          </div>
        </div>
      )}

      {showBillOverlay && (
        <div className="pm-overlay" onClick={() => onActivePanelChange("menu")}>
          <div className="pm-sheet p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display mb-2 text-lg text-[var(--pm-on-surface)]">Generate Bill</h2>
            {billRequested ? (
              <p className="mb-4 text-sm text-emerald-700">
                Your bill has been requested. A waiter will bring it shortly.
              </p>
            ) : (
              <>
                <p className="mb-6 text-sm leading-relaxed text-[var(--pm-on-surface-variant)]">
                  {activeOrderTotal != null
                    ? `Current total: ${formatCurrency(activeOrderTotal)}`
                    : cartCount > 0
                      ? `Estimated total: ${formatCurrency(cartTotal)}`
                      : "Request the bill when you are ready to pay."}
                </p>
                {trackingItems && trackingItems.length > 0 && (
                  <ul className="mb-6 max-h-48 space-y-2 overflow-y-auto text-left">
                    {trackingItems.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span className="min-w-0 truncate text-[var(--pm-on-surface)]">
                          {item.quantity}× {item.billDisplayName?.trim() || item.name}
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${kitchenStatusBadgeClass(item.kitchenStatus)}`}
                        >
                          {formatKitchenStatusLabel(item.kitchenStatus)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  disabled={actionLoading || billRequested}
                  onClick={() => void onRequestBill()}
                  className="pm-btn-primary w-full py-3"
                >
                  {actionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Receipt className="h-4 w-4" />
                  )}
                  Generate Bill
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => onActivePanelChange("menu")}
              className="pm-press mt-3 w-full py-2.5 text-sm text-[var(--pm-on-surface-variant)]"
            >
              Back to menu
            </button>
          </div>
        </div>
      )}
    </>
  );
}
