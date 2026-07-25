"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { formatKitchenStatusLabel } from "@/lib/kitchen-status-label";
import { Minus, Plus, Send, Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConfigurableProduct, ProductSelection } from "@/features/product-config";
import {
  ProductConfiguratorSheet,
  OrderLineItem,
  parseModifierSnapshots,
} from "@/features/product-config";
import type { MenuProductCard } from "@/lib/menu-catalog/types";
import { useProgressiveMenu } from "@/features/menu/hooks/use-progressive-menu";
import {
  fetchStaffCategoryProducts,
  fetchStaffProductConfig,
  searchStaffMenu,
} from "@/lib/qr-client";
import { PrintReceiptButton } from "@/features/printing/components/print-receipt-button";

export type OrderInterfaceProduct = ConfigurableProduct & {
  imageUrl?: string | null;
};

export type OrderInterfaceCategory = {
  id: string;
  name: string;
  /** Left empty; products load progressively. */
  products: OrderInterfaceProduct[];
};

export type OrderInterfaceItem = {
  id: string;
  productId?: string;
  name: string;
  billDisplayName?: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  kitchenStatus: string;
  kitchenNotes: string | null;
  notes: string | null;
  variantId?: string | null;
  variantNameSnapshot?: string | null;
  modifiers: unknown;
  revisionNumber: number;
  createdAt: Date | string;
};

export type OrderInterfaceOrder = {
  id: string;
  status: string;
  total: number;
  subtotal: number;
  discountAmount: number;
  promotionDiscountAmount?: number;
  items: OrderInterfaceItem[];
  revisions: { revisionNumber: number; submittedAt: Date | string }[];
};

export type AddItemPayload = {
  productId: string;
  quantity: number;
  variantId?: string | null;
  modifierIds?: string[];
  notes?: string;
  kitchenNotes?: string;
};

export type OrderInterfaceActions = {
  addItem: (payload: AddItemPayload) => Promise<void>;
  updateItemConfig?: (itemId: string, selection: ProductSelection) => Promise<void>;
  updateQty: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  submitKitchen: () => Promise<void>;
};

type Props = {
  sessionId?: string;
  tableLabel: string;
  guestCount: number;
  customerName?: string | null;
  categories: OrderInterfaceCategory[];
  activeOrder: OrderInterfaceOrder | null;
  actions: OrderInterfaceActions;
  onBack?: () => void;
  backLabel?: string;
  subtitle?: string;
  showSearch?: boolean;
  footerExtra?: React.ReactNode;
  allowSentItemEdits?: boolean;
};

function cardHasOptions(product: MenuProductCard): boolean {
  return product.hasVariants || product.hasModifiers || product.hasAddOns;
}

function formatCardPrice(product: MenuProductCard): string {
  if (product.showFromPrice ?? product.hasVariants) {
    return `From ${formatCurrency(product.displayFromPrice)}`;
  }
  return formatCurrency(product.price);
}

export function OrderInterface({
  tableLabel,
  guestCount,
  customerName,
  categories,
  activeOrder,
  actions,
  onBack,
  backLabel = "Back",
  subtitle,
  showSearch = true,
  footerExtra,
  allowSentItemEdits = false,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id ?? "");
  const [kitchenNotes, setKitchenNotes] = useState("");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<MenuProductCard[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [configProduct, setConfigProduct] = useState<OrderInterfaceProduct | null>(null);
  const [editItem, setEditItem] = useState<OrderInterfaceItem | null>(null);
  const [openingProductId, setOpeningProductId] = useState<string | null>(null);

  const fetchers = useMemo(
    () => ({
      fetchCategoryProducts: fetchStaffCategoryProducts,
      fetchProductConfig: fetchStaffProductConfig,
      searchProducts: searchStaffMenu,
    }),
    []
  );

  const {
    ensureCategoryProducts,
    ensureProductConfig,
    getCategoryProducts,
    isCategoryLoading,
  } = useProgressiveMenu({
    categories: categories.map((c) => ({ id: c.id, products: [] })),
    fetchers,
    prefetchFirst: true,
  });

  useEffect(() => {
    if (activeCategory && !search.trim()) {
      void ensureCategoryProducts(activeCategory);
    }
  }, [activeCategory, search, ensureCategoryProducts]);

  useEffect(() => {
    const q = search.trim();
    if (!q) {
      setSearchResults(null);
      return;
    }
    setSearchLoading(true);
    const t = window.setTimeout(() => {
      void searchStaffMenu(q)
        .then((results) => setSearchResults(results as MenuProductCard[]))
        .finally(() => setSearchLoading(false));
    }, 250);
    return () => window.clearTimeout(t);
  }, [search]);

  const products = useMemo(() => {
    if (search.trim()) return searchResults ?? [];
    return getCategoryProducts(activeCategory);
  }, [search, searchResults, getCategoryProducts, activeCategory]);

  const categoryLoading =
    !search.trim() && isCategoryLoading(activeCategory) && products.length === 0;

  const pendingCount =
    activeOrder?.items.filter((i) => i.kitchenStatus === "PENDING").length ?? 0;

  function run(fn: () => Promise<void>) {
    startTransition(async () => {
      await fn();
    });
  }

  const openProduct = useCallback(
    async (card: MenuProductCard) => {
      setEditItem(null);
      setOpeningProductId(card.id);
      try {
        const config = await ensureProductConfig(card.id);
        if (!config) return;
        setConfigProduct({
          ...config,
          imageUrl: card.images[0]?.media.url ?? null,
        });
      } finally {
        setOpeningProductId(null);
      }
    },
    [ensureProductConfig]
  );

  async function openEditItem(item: OrderInterfaceItem) {
    if (!item.productId) return;
    setOpeningProductId(item.productId);
    try {
      const config = await ensureProductConfig(item.productId);
      if (!config) return;
      setEditItem(item);
      setConfigProduct({
        ...config,
        imageUrl: config.images?.[0]?.media.url ?? null,
      });
    } finally {
      setOpeningProductId(null);
    }
  }

  function handleConfirm(selection: ProductSelection) {
    if (!configProduct) return;
    if (editItem && actions.updateItemConfig) {
      run(async () => {
        await actions.updateItemConfig!(editItem.id, selection);
        setConfigProduct(null);
        setEditItem(null);
        setKitchenNotes("");
      });
      return;
    }
    run(async () => {
      await actions.addItem({
        productId: configProduct.id,
        quantity: selection.quantity,
        variantId: selection.variantId,
        modifierIds: selection.modifierIds,
        notes: selection.notes,
        kitchenNotes: selection.kitchenNotes ?? (kitchenNotes || undefined),
      });
      setConfigProduct(null);
      setKitchenNotes("");
    });
  }

  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col lg:flex-row">
      <div className="flex-1 border-r border-tertiary-fixed">
        <div className="border-b border-tertiary-fixed p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="mb-2 text-label-sm text-primary hover:underline"
                >
                  ← {backLabel}
                </button>
              )}
              <h1 className="font-display text-headline-sm font-semibold">{tableLabel}</h1>
              <p className="text-sm text-on-surface-variant">
                {guestCount} guests{customerName ? ` · ${customerName}` : ""}
              </p>
              {subtitle && (
                <p className="mt-1 text-sm text-on-surface-variant">{subtitle}</p>
              )}
            </div>
          </div>
        </div>

        {showSearch && (
          <div className="border-b border-tertiary-fixed p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
              <Input
                placeholder="Search products…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        )}

        {!search && (
          <div className="flex gap-1 overflow-x-auto border-b border-tertiary-fixed p-2">
            {categories.map((cat) => (
              <Button
                key={cat.id}
                size="sm"
                variant={activeCategory === cat.id ? "default" : "outline"}
                onClick={() => {
                  setActiveCategory(cat.id);
                  void ensureCategoryProducts(cat.id);
                }}
              >
                {cat.name}
              </Button>
            ))}
          </div>
        )}

        <div className="border-b border-tertiary-fixed p-2">
          <Input
            placeholder="Kitchen notes for next item…"
            value={kitchenNotes}
            onChange={(e) => setKitchenNotes(e.target.value)}
            className="text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3">
          {(categoryLoading || searchLoading) && products.length === 0 && (
            <div className="col-span-full flex items-center justify-center gap-2 py-12 text-sm text-on-surface-variant">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading products…
            </div>
          )}
          {products.map((product) => (
            <button
              key={product.id}
              type="button"
              disabled={pending || openingProductId === product.id}
              onClick={() => void openProduct(product)}
              className={cn(
                "overflow-hidden rounded-lg border border-tertiary-fixed text-left transition-colors hover:bg-surface-container-low",
                (pending || openingProductId === product.id) && "opacity-50"
              )}
            >
              {product.images[0]?.media.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.images[0].media.url}
                  alt={product.name}
                  className="aspect-[4/3] w-full object-cover"
                />
              )}
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{product.name}</p>
                  {cardHasOptions(product) && (
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      Customize
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {formatCardPrice(product)}
                </p>
              </div>
            </button>
          ))}
          {!categoryLoading && !searchLoading && search.trim() && products.length === 0 && (
            <p className="col-span-full py-8 text-center text-sm text-on-surface-variant">
              No products found
            </p>
          )}
        </div>
      </div>

      <div className="flex w-full flex-col bg-surface-container-low lg:w-96">
        <div className="flex items-center justify-between border-b border-tertiary-fixed p-4">
          <span className="font-semibold">Order</span>
          {activeOrder && <Badge variant="outline">{activeOrder.status}</Badge>}
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {!activeOrder?.items.length && (
            <p className="py-8 text-center text-sm text-on-surface-variant">
              Tap menu items to add
            </p>
          )}
          {activeOrder?.items.map((item) => {
            const isPending = item.kitchenStatus === "PENDING";
            const isEditable = isPending || allowSentItemEdits;
            const canEditConfig = isPending && item.productId && actions.updateItemConfig;
            return (
              <div key={item.id} className="flex items-start gap-2 text-sm">
                {isEditable ? (
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7"
                      onClick={() =>
                        run(async () => {
                          if (item.quantity <= 1) await actions.removeItem(item.id);
                          else await actions.updateQty(item.id, item.quantity - 1);
                        })
                      }
                      disabled={pending}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center">{item.quantity}</span>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7"
                      onClick={() => run(() => actions.updateQty(item.id, item.quantity + 1))}
                      disabled={pending || !isPending}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <span className="w-16 text-center font-medium">{item.quantity}×</span>
                )}
                <div className="flex-1">
                  <OrderLineItem
                    name={item.name}
                    billDisplayName={item.billDisplayName}
                    variantNameSnapshot={item.variantNameSnapshot}
                    modifiers={item.modifiers}
                    quantity={item.quantity}
                    unitPrice={item.unitPrice}
                    totalPrice={item.totalPrice}
                    notes={item.notes}
                    kitchenNotes={item.kitchenNotes}
                    onClick={canEditConfig ? () => void openEditItem(item) : undefined}
                  />
                  <p className="mt-1 text-xs capitalize text-on-surface-variant">
                    {formatKitchenStatusLabel(item.kitchenStatus)}
                    {item.revisionNumber > 0 ? ` · ticket #${item.revisionNumber}` : ""}
                  </p>
                </div>
                <span className="shrink-0">{formatCurrency(item.totalPrice)}</span>
              </div>
            );
          })}
        </div>
        {activeOrder && (
          <div className="space-y-3 border-t border-tertiary-fixed p-4">
            {(activeOrder.promotionDiscountAmount ?? 0) > 0 && (
              <div className="flex justify-between text-sm text-secondary">
                <span>Promotion</span>
                <span>-{formatCurrency(activeOrder.promotionDiscountAmount ?? 0)}</span>
              </div>
            )}
            {activeOrder.discountAmount > 0 && (
              <div className="flex justify-between text-sm text-secondary">
                <span>Discount</span>
                <span>-{formatCurrency(activeOrder.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span>{formatCurrency(activeOrder.total)}</span>
            </div>
            {activeOrder.revisions.length > 0 && (
              <p className="text-xs text-on-surface-variant">
                {activeOrder.revisions.length} ticket(s) sent to kitchen
              </p>
            )}
            <Button
              className="w-full"
              onClick={() => run(actions.submitKitchen)}
              disabled={pending || pendingCount === 0}
            >
              <Send className="mr-2 h-4 w-4" />
              Send {pendingCount > 0 ? `${pendingCount} new item(s)` : ""} to kitchen
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <PrintReceiptButton orderId={activeOrder.id} kind="kot" triggerLabel="Print KOT" />
              <PrintReceiptButton orderId={activeOrder.id} kind="bill" triggerLabel="Print bill" />
            </div>
            {footerExtra}
          </div>
        )}
      </div>

      {configProduct && (
        <ProductConfiguratorSheet
          product={configProduct}
          open={Boolean(configProduct)}
          onClose={() => {
            setConfigProduct(null);
            setEditItem(null);
          }}
          onConfirm={handleConfirm}
          confirmLabel={editItem ? "Save changes" : "Add to Order"}
          showNotes
          presentation="dialog"
          initialSelection={
            editItem
              ? {
                  variantId: editItem.variantId,
                  modifierIds: parseModifierSnapshots(editItem.modifiers).map((m) => m.modifierId),
                  quantity: editItem.quantity,
                  notes: editItem.notes ?? undefined,
                  kitchenNotes: editItem.kitchenNotes ?? undefined,
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
