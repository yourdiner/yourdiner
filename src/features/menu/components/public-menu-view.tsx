"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import {
  Search,
  Plus,
  Check,
  ShoppingBag,
  Receipt,
  Utensils,
  Hand,
  Bell,
  Minus,
  Loader2,
  Send,
  LayoutGrid,
  Flame,
  Leaf,
  Star,
  ChefHat,
  Ban,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import {
  searchPublicMenu,
  fetchPublicCategoryProducts,
  fetchPublicProductConfig,
  fetchStaffCategoryProducts,
  fetchStaffProductConfig,
  searchStaffMenu,
} from "@/lib/qr-client";
import { customerOrderMutation, fetchCustomerActiveOrder } from "@/lib/customer-order-client";
import {
  formatKitchenStatusLabel,
  kitchenStatusBadgeClass,
} from "@/lib/kitchen-status-label";
import { toast } from "sonner";
import Link from "next/link";
import { StaffLogoutButton } from "@/features/staff/components/staff-logout-button";
import {
  type MenuProduct,
  type MenuProductCard,
  type MenuData,
  type MenuViewMode,
  type MenuActiveOrder,
  type StaffMenuActions,
  type StaffShellInfo,
  type OrderPanel,
} from "@/features/menu/components/public-menu-types";
import {
  menuProductToConfigurable,
  configurableToMenuProduct,
  formatMenuCardPrice,
  productHasOptions,
} from "@/features/menu/components/menu-product-helpers";
import { useProgressiveMenu } from "@/features/menu/hooks/use-progressive-menu";
import {
  ProductConfiguratorSheet,
  OrderLineItem,
  cartLineKey,
  priceSelection,
  type ProductSelection,
} from "@/features/product-config";
import { SOCIAL_LINK_LABELS, type SocialLinkKey } from "@/lib/social-links";

export type {
  MenuProduct,
  MenuData,
  MenuViewMode,
  MenuActiveOrder,
  StaffMenuActions,
  StaffShellInfo,
} from "@/features/menu/components/public-menu-types";

const PublicMenuOrderChrome = dynamic(
  () =>
    import("@/features/menu/components/public-menu-order-chrome").then(
      (module) => module.PublicMenuOrderChrome
    ),
  { ssr: false }
);

type CartItem = {
  product: MenuProduct;
  quantity: number;
  variantId?: string | null;
  modifierIds: string[];
  notes?: string;
};

function getCartItemKey(item: CartItem) {
  return cartLineKey(item.product.id, item.variantId, item.modifierIds, item.notes);
}

type PublicMenuViewProps = {
  menu: MenuData;
  tableLabel?: string;
  mode?: MenuViewMode;
  diningSessionId?: string;
  tableSlug?: string;
  /** @deprecated use tableSlug */
  tableToken?: string;
  customerName?: string;
  onSessionEnded?: () => void;
  staffActions?: StaffMenuActions;
  staffShell?: StaffShellInfo;
  activeOrder?: MenuActiveOrder | null;
  guestCount?: number;
  /** @deprecated use mode="customer" instead */
  orderingEnabled?: boolean;
  /** When true, menu is browsable but cart/order actions show a waiting message */
  orderingLocked?: boolean;
  orderingLockedMessage?: string;
};

const DEFAULT_ORDERING_LOCKED_MESSAGE =
  "Your table is waiting for approval from the restaurant. You can browse the menu while you wait.";

function useMenuTheme(branding: MenuData["restaurant"]["branding"]) {
  return useMemo(
    () =>
      ({
        "--pm-primary": branding?.primaryColor || "#425646",
        "--pm-secondary": branding?.secondaryColor || branding?.accentColor || "#8d4c40",
        "--pm-primary-container": branding?.primaryColor || "#5a6e5d",
      }) as React.CSSProperties,
    [branding?.primaryColor, branding?.secondaryColor, branding?.accentColor]
  );
}

export function PublicMenuView({
  menu,
  tableLabel,
  mode: modeProp,
  diningSessionId,
  tableSlug: tableSlugProp,
  tableToken,
  customerName,
  onSessionEnded,
  staffActions,
  staffShell,
  activeOrder,
  guestCount,
  orderingEnabled,
  orderingLocked = false,
  orderingLockedMessage = DEFAULT_ORDERING_LOCKED_MESSAGE,
}: PublicMenuViewProps) {
  const mode: MenuViewMode =
    modeProp ?? (orderingEnabled ? "customer" : "browse");
  // General QR / browse-only: never cart or order, even on premium plans.
  const isBrowseOnly = mode === "browse" && !orderingLocked;
  const canOrder = !isBrowseOnly && (mode === "customer" || mode === "staff");
  const canMutateOrder = canOrder && !orderingLocked;
  const showOrderingAffordance = canOrder || orderingLocked;
  const isStaffEmbedded = mode === "staff";

  // Staff order uses one combined header (no separate staff shell bar on order pages).
  const menuHeaderTop = isStaffEmbedded ? "top-0" : "top-0";
  const menuHeaderHeight = isStaffEmbedded ? "h-auto" : "h-16 md:h-20";
  const contentTopPad = isStaffEmbedded ? "pt-[7.25rem]" : "pt-16 md:pt-20";
  const sidebarStickyTop = isStaffEmbedded ? "top-[7.25rem]" : "top-16 md:top-20";
  const sidebarHeight = isStaffEmbedded
    ? "h-[calc(100vh-7.25rem)]"
    : "h-[calc(100vh-4rem)] md:h-[calc(100vh-5rem)]";
  const sidebarBreakpoint = isStaffEmbedded ? "md:flex" : "lg:flex";
  const categoryPillsBreakpoint = isStaffEmbedded ? "md:hidden" : "lg:hidden";

  const [activeCategory, setActiveCategory] = useState(menu.categories[0]?.id || "");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(isStaffEmbedded);
  const [searchResults, setSearchResults] = useState<MenuProductCard[] | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<MenuProduct | null>(null);
  const [configLoadingId, setConfigLoadingId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [headerShadow, setHeaderShadow] = useState(false);
  const [activePanel, setActivePanel] = useState<OrderPanel>("menu");
  const [billRequested, setBillRequested] = useState(false);
  const [callingWaiter, setCallingWaiter] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [customerActiveOrder, setCustomerActiveOrder] = useState<MenuActiveOrder | null>(
    activeOrder ?? null
  );
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardByIdRef = useRef<Map<string, MenuProductCard>>(new Map());

  const branding = menu.restaurant.branding;
  const themeStyle = useMenuTheme(branding);

  const progressiveFetchers = useMemo(
    () =>
      isStaffEmbedded
        ? {
            fetchCategoryProducts: fetchStaffCategoryProducts,
            fetchProductConfig: fetchStaffProductConfig,
            searchProducts: searchStaffMenu,
          }
        : {
            fetchCategoryProducts: fetchPublicCategoryProducts,
            fetchProductConfig: fetchPublicProductConfig,
            searchProducts: (q: string) => searchPublicMenu(menu.restaurant.id, q),
          },
    [isStaffEmbedded, menu.restaurant.id]
  );

  const {
    ensureCategoryProducts,
    ensureProductConfig,
    getCategoryProducts,
    isCategoryLoading,
  } = useProgressiveMenu({
    categories: menu.categories,
    fetchers: progressiveFetchers,
    prefetchFirst: true,
  });

  useEffect(() => {
    const onScroll = () => setHeaderShadow(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (mode === "staff") {
      setCustomerActiveOrder(activeOrder ?? null);
    }
  }, [mode, activeOrder]);

  const refreshCustomerOrder = useCallback(async () => {
    if (mode !== "customer" || !diningSessionId || orderingLocked) return;
    const result = await fetchCustomerActiveOrder(diningSessionId);
    if (result.ok) {
      setCustomerActiveOrder(result.data);
    }
  }, [mode, diningSessionId, orderingLocked]);

  useEffect(() => {
    void refreshCustomerOrder();
  }, [refreshCustomerOrder]);

  useEffect(() => {
    if (mode !== "customer" || !diningSessionId || orderingLocked) return;
    const id = setInterval(() => {
      void refreshCustomerOrder();
    }, 10_000);
    return () => clearInterval(id);
  }, [mode, diningSessionId, orderingLocked, refreshCustomerOrder]);

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, []);

  // Keep the selected category's products loaded (covers first category + switches)
  useEffect(() => {
    if (activeCategory && activePanel === "menu" && !searchResults) {
      void ensureCategoryProducts(activeCategory);
    }
  }, [activeCategory, activePanel, searchResults, ensureCategoryProducts]);

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
      if (!query.trim()) {
        setSearchResults(null);
        return;
      }
      searchDebounceRef.current = setTimeout(() => {
        const searchFn =
          progressiveFetchers.searchProducts ??
          ((q: string) => searchPublicMenu(menu.restaurant.id, q));
        void searchFn(query).then((results) => {
          setSearchResults(results as MenuProductCard[]);
        });
      }, 300);
    },
    [menu.restaurant.id, progressiveFetchers]
  );

  const selectCategory = (id: string) => {
    setActiveCategory(id);
    setActivePanel("menu");
    setSearchResults(null);
    setSearchQuery("");
    void ensureCategoryProducts(id);
  };

  const openProductCard = async (card: MenuProductCard) => {
    // Keep menu panel active so order overlays do not trap focus under the sheet.
    if (activePanel !== "menu") setActivePanel("menu");
    if (cartOpen) setCartOpen(false);
    cardByIdRef.current.set(card.id, card);
    setConfigLoadingId(card.id);
    try {
      const config = await ensureProductConfig(card.id);
      if (!config) {
        toast.error("Could not load product options");
        return;
      }
      setSelectedProduct(configurableToMenuProduct(config, card));
    } finally {
      setConfigLoadingId(null);
    }
  };

  const flashAdded = (productId: string) => {
    setAddedIds((prev) => new Set(prev).add(productId));
    setTimeout(() => {
      setAddedIds((prev) => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
    }, 1500);
  };

  const addToCart = (product: MenuProduct, selection: ProductSelection) => {
    if (product.isOutOfStock) return;
    const key = cartLineKey(
      product.id,
      selection.variantId,
      selection.modifierIds,
      selection.notes,
      selection.kitchenNotes
    );
    setCart((prev) => {
      const existing = prev.find((i) => getCartItemKey(i) === key);
      if (existing) {
        return prev.map((i) =>
          getCartItemKey(i) === key
            ? { ...i, quantity: i.quantity + selection.quantity }
            : i
        );
      }
      return [
        ...prev,
        {
          product,
          quantity: selection.quantity,
          variantId: selection.variantId,
          modifierIds: selection.modifierIds,
          notes: selection.notes,
        },
      ];
    });
    flashAdded(product.id);
  };

  const handleConfiguratorConfirm = async (selection: ProductSelection) => {
    if (!selectedProduct || selectedProduct.isOutOfStock) return;
    if (isBrowseOnly) return;

    if (orderingLocked) {
      toast.info(orderingLockedMessage);
      return;
    }

    if (mode === "staff" && staffActions) {
      setActionLoading(true);
      try {
        await staffActions.addItem(selectedProduct.id, selection.quantity, {
          variantId: selection.variantId,
          modifierIds: selection.modifierIds,
          notes: selection.notes,
        });
        flashAdded(selectedProduct.id);
        const priced = priceSelection(menuProductToConfigurable(selectedProduct), selection);
        const label = priced.variantName
          ? `${selectedProduct.name} (${priced.variantName})`
          : selectedProduct.name;
        toast.success(`${label} added`);
        setSelectedProduct(null);
      } catch {
        toast.error("Failed to add item");
      } finally {
        setActionLoading(false);
      }
      return;
    }

    if (mode === "customer") {
      addToCart(selectedProduct, selection);
      setSelectedProduct(null);
    }
  };

  const handleAddProduct = (product: MenuProductCard) => {
    if (product.isOutOfStock) return;
    void openProductCard(product);
  };

  const updateCartQty = (key: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) =>
          getCartItemKey(i) === key ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i
        )
        .filter((i) => i.quantity > 0)
    );
  };

  const removeFromCart = (key: string) => {
    setCart((prev) => prev.filter((i) => getCartItemKey(i) !== key));
  };

  const tableSlug = tableSlugProp ?? tableToken;

  const handleSessionError = (result: { ok: false; error: string; code?: string }) => {
    if (result.code === "SESSION_ENDED" || result.code === "SESSION_REJECTED") {
      onSessionEnded?.();
      toast.error(result.error);
      return true;
    }
    return false;
  };

  const canSubmitOrder = Boolean(canMutateOrder && mode === "customer" && diningSessionId && tableSlug);

  const handlePlaceOrder = async () => {
    if (orderingLocked) {
      toast.info(orderingLockedMessage);
      return;
    }
    if (!canSubmitOrder || cart.length === 0) return;
    setSubmitting(true);
    try {
      for (const item of cart) {
        const result = await customerOrderMutation(diningSessionId!, tableSlug!, {
          action: "addItem",
          productId: item.product.id,
          quantity: item.quantity,
          variantId: item.variantId ?? undefined,
          modifierIds: item.modifierIds,
          notes: item.notes,
        });
        if (!result.ok) {
          if (handleSessionError(result)) return;
          toast.error(result.error);
          return;
        }
      }
      const submitResult = await customerOrderMutation(diningSessionId!, tableSlug!, {
        action: "submitOrder",
      });
      if (!submitResult.ok) {
        if (handleSessionError(submitResult)) return;
        toast.error(submitResult.error);
        return;
      }
      setCart([]);
      setCartOpen(false);
      setOrderPlaced(true);
      await refreshCustomerOrder();
      if (submitResult.data?.awaitingApproval) {
        toast.success("Order submitted — waiting for staff approval");
      } else {
        toast.success("Order sent to kitchen!");
      }
    } catch {
      toast.error("Failed to place order");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCallWaiter = async () => {
    if (mode !== "customer" || !diningSessionId || !tableSlug) return;
    setCallingWaiter(true);
    try {
      const result = await customerOrderMutation(diningSessionId, tableSlug, {
        action: "callWaiter",
      });
      if (!result.ok) {
        if (handleSessionError(result)) return;
        toast.error(result.error);
        return;
      }
      toast.success("Waiter has been notified");
      setActivePanel("menu");
    } catch {
      toast.error("Failed to call waiter");
    } finally {
      setCallingWaiter(false);
    }
  };

  const handleRequestBill = async () => {
    if (mode === "customer" && diningSessionId && tableSlug) {
      setActionLoading(true);
      try {
        const result = await customerOrderMutation(diningSessionId, tableSlug, {
          action: "requestBill",
        });
        if (!result.ok) {
          if (handleSessionError(result)) return;
          toast.error(result.error);
          return;
        }
        setBillRequested(true);
        toast.success("Bill requested");
      } catch {
        toast.error("Failed to request bill");
      } finally {
        setActionLoading(false);
      }
    } else if (mode === "staff" && staffActions) {
      setActionLoading(true);
      try {
        await staffActions.requestBill();
        setBillRequested(true);
        toast.success("Bill requested");
      } catch {
        toast.error("Failed to request bill");
      } finally {
        setActionLoading(false);
      }
    }
  };

  const handleStaffAction = async (action: () => Promise<void>, successMsg?: string) => {
    setActionLoading(true);
    try {
      await action();
      if (successMsg) toast.success(successMsg);
    } catch {
      toast.error("Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  const cartTotal = cart.reduce((sum, item) => {
    const priced = priceSelection(menuProductToConfigurable(item.product), {
      variantId: item.variantId,
      modifierIds: item.modifierIds,
      quantity: item.quantity,
    });
    return sum + priced.totalPrice;
  }, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const liveOrder = mode === "staff" ? activeOrder : customerActiveOrder;
  const staffPendingItems =
    liveOrder?.items.filter((i) => i.kitchenStatus === "PENDING") ?? [];
  const previousOrderedItems =
    liveOrder?.items.filter(
      (i) => i.kitchenStatus !== "PENDING" && i.kitchenStatus !== "CANCELLED"
    ) ?? [];
  const staffPendingCount = staffPendingItems.reduce((s, i) => s + i.quantity, 0);
  const previousOrderCount = previousOrderedItems.reduce((s, i) => s + i.quantity, 0);
  const orderCount = mode === "staff" ? staffPendingCount : cartCount;
  const orderTabBadge =
    mode === "customer" ? cartCount + previousOrderCount : orderCount;

  const staffQtyByProduct = useMemo(() => {
    const map = new Map<string, number>();
    if (mode !== "staff" || !activeOrder) return map;
    for (const item of activeOrder.items) {
      if (!item.productId || item.kitchenStatus !== "PENDING") continue;
      map.set(item.productId, (map.get(item.productId) ?? 0) + item.quantity);
    }
    return map;
  }, [mode, activeOrder]);

  const getPendingItemForProduct = (productId: string) =>
    activeOrder?.items.find(
      (i) => i.productId === productId && i.kitchenStatus === "PENDING"
    );

  const handleDecrementProduct = async (product: MenuProductCard) => {
    // Only pending (unsaved/unsent) lines can be reduced from the menu card.
    // Products with options must be edited in the order panel so the correct variant is targeted.
    if (productHasOptions(product)) {
      toast.info("Open the order panel to change quantities for items with options");
      return;
    }
    const pendingItem = getPendingItemForProduct(product.id);
    if (!pendingItem || !staffActions) return;
    if (pendingItem.kitchenStatus !== "PENDING") {
      toast.error("Items sent to kitchen cannot be changed");
      return;
    }
    if (pendingItem.quantity <= 1) {
      await handleStaffAction(() => staffActions.removeItem(pendingItem.id));
    } else {
      await handleStaffAction(() =>
        staffActions.updateQty(pendingItem.id, pendingItem.quantity - 1)
      );
    }
  };

  const handleStaffQuickIncrement = async (product: MenuProductCard) => {
    // Simple products: bump the single pending line. Options/variants always reopen the sheet
    // so Regular vs Large (etc.) become separate lines instead of silently merging.
    if (productHasOptions(product)) {
      void handleAddProduct(product);
      return;
    }
    const pendingItem = getPendingItemForProduct(product.id);
    if (!pendingItem || !staffActions) {
      void handleAddProduct(product);
      return;
    }
    await handleStaffAction(() =>
      staffActions.updateQty(pendingItem.id, pendingItem.quantity + 1)
    );
  };

  const heroSubtitle =
    branding?.about?.split(".")[0] ||
    `Welcome to ${menu.restaurant.name}`;

  const navBtnClass = (panel: OrderPanel) =>
    `pm-nav-item pm-press flex w-full cursor-pointer items-center gap-3 rounded-[var(--pm-radius-md)] px-3 py-2.5 text-sm font-medium ${
      activePanel === panel
        ? "bg-[var(--pm-primary-fixed)] font-semibold text-[var(--pm-primary)]"
        : "text-[var(--pm-on-surface-variant)]"
    }`;

  const renderProductBadges = (product: MenuProductCard) => (
    <div className="absolute left-2 top-2 z-10 flex flex-wrap gap-1">
      {product.dietaryType === "VEG" && (
        <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/70 bg-white/95 text-emerald-700 shadow-[var(--pm-shadow-sm)]" title="Vegetarian">
          <Leaf className="h-3 w-3" />
        </span>
      )}
      {product.dietaryType === "NON_VEG" && (
        <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/70 bg-white/95 text-[9px] font-bold text-rose-700 shadow-[var(--pm-shadow-sm)]" title="Non-Veg">
          NV
        </span>
      )}
      {product.spicyLevel > 0 && (
        <span className="flex h-6 items-center gap-0.5 rounded-full border border-white/70 bg-white/95 px-1.5 text-orange-700 shadow-[var(--pm-shadow-sm)]" title={`Spicy level ${product.spicyLevel}`}>
          <Flame className="h-3 w-3" />
          {product.spicyLevel > 1 && <span className="text-[9px] font-bold">{product.spicyLevel}</span>}
        </span>
      )}
      {product.isOutOfStock && (
        <span className="flex h-6 items-center rounded-full bg-neutral-900/80 px-1.5 text-white" title="Out of stock">
          <Ban className="h-3 w-3" />
        </span>
      )}
      {product.isFeatured && (
        <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/70 bg-white/95 text-amber-600 shadow-[var(--pm-shadow-sm)]" title="Featured">
          <Star className="h-3 w-3" />
        </span>
      )}
      {product.isChefSpecial && (
        <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/70 bg-white/95 text-violet-700 shadow-[var(--pm-shadow-sm)]" title="Chef special">
          <ChefHat className="h-3 w-3" />
        </span>
      )}
    </div>
  );

  const renderQtyControls = (product: MenuProductCard, justAdded: boolean, orderQty: number) => {
    if (canOrder && !product.isOutOfStock && mode === "staff" && orderQty > 0) {
      // Multi-variant / modifier products: never show product-level −/+ (that targets the
      // first pending line only). Always open the configurator to add another size/option.
      if (productHasOptions(product)) {
        return (
          <button
            type="button"
            disabled={actionLoading}
            onClick={(e) => {
              e.stopPropagation();
              void handleAddProduct(product);
            }}
            className={`pm-press flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-[var(--pm-radius-md)] border px-2.5 text-xs font-medium ${
              justAdded
                ? "border-transparent bg-[var(--pm-primary)] text-white"
                : "border-[var(--pm-outline-variant)] bg-[var(--pm-surface-container-lowest)] text-[var(--pm-on-surface)]"
            }`}
            aria-label={`Add another ${product.name}`}
          >
            {justAdded ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            Add
          </button>
        );
      }
      return (
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={actionLoading}
            onClick={(e) => {
              e.stopPropagation();
              void handleDecrementProduct(product);
            }}
            className="pm-press flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-[var(--pm-radius-md)] border border-[var(--pm-outline-variant)] bg-[var(--pm-surface-container-lowest)] text-[var(--pm-on-surface)]"
            aria-label="Decrease quantity"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={actionLoading}
            onClick={(e) => {
              e.stopPropagation();
              void handleStaffQuickIncrement(product);
            }}
            className={`pm-press flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-[var(--pm-radius-md)] border ${
              justAdded
                ? "border-transparent bg-[var(--pm-primary)] text-white"
                : "border-[var(--pm-outline-variant)] bg-[var(--pm-surface-container-lowest)] text-[var(--pm-on-surface)]"
            }`}
            aria-label="Increase quantity"
          >
            {justAdded ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          </button>
        </div>
      );
    }
    if (showOrderingAffordance && !product.isOutOfStock) {
      return (
        <button
          type="button"
          disabled={actionLoading}
          onClick={(e) => {
            e.stopPropagation();
            void handleAddProduct(product);
          }}
          className={`pm-press flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-[var(--pm-radius-md)] border ${
            justAdded
              ? "border-transparent bg-[var(--pm-primary)] text-white"
              : "border-[var(--pm-outline-variant)] bg-[var(--pm-surface-container-lowest)] text-[var(--pm-on-surface)]"
          }`}
          aria-label={`Add ${product.name}`}
        >
          {justAdded ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        </button>
      );
    }
    return null;
  };

  const renderProductCard = (product: MenuProductCard) => {
    const hasImage = Boolean(product.images[0]);
    const priceLabel = formatMenuCardPrice(product, formatCurrency);
    const hasOptions = productHasOptions(product);
    const justAdded = addedIds.has(product.id);
    const orderQty = mode === "staff" ? staffQtyByProduct.get(product.id) ?? 0 : 0;
    const isLoadingConfig = configLoadingId === product.id;

    return (
      <article
        key={product.id}
        className="pm-product-card"
        onClick={() => void openProductCard(product)}
      >
        <div className="pm-product-media">
          {renderProductBadges(product)}
          {hasImage ? (
            <Image
              src={product.images[0].media.url}
              alt={product.name}
              width={400}
              height={300}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[var(--pm-outline)]">
              <Utensils className="h-7 w-7 opacity-35" />
            </div>
          )}
          {product.isOutOfStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/55 backdrop-blur-[1px]">
              <span className="rounded-full bg-neutral-900/85 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white">
                Out of stock
              </span>
            </div>
          )}
          {isLoadingConfig && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/40">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--pm-primary)]" />
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2 p-3">
          <div className="min-w-0 flex-1">
            <h4 className="font-display line-clamp-2 text-[13px] leading-snug text-[var(--pm-on-surface)] sm:text-sm">
              {product.name}
            </h4>
            {hasOptions && (
              <p className="mt-0.5 text-[11px] font-medium text-[var(--pm-primary)]">
                Customizable
              </p>
            )}
            {product.shortDescription && (
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--pm-on-surface-variant)]">
                {product.shortDescription}
              </p>
            )}
          </div>
          <div className="mt-auto flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="text-sm font-semibold tabular-nums tracking-tight text-[var(--pm-on-surface)]">
                {priceLabel}
              </span>
              {orderQty > 0 && (
                <span className="rounded-full bg-[var(--pm-primary-fixed)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--pm-primary)]">
                  ×{orderQty}
                </span>
              )}
            </div>
            {renderQtyControls(product, justAdded, orderQty)}
          </div>
        </div>
      </article>
    );
  };

  const renderOrderPanel = () => {
    if (mode === "staff") {
      const renderStaffItem = (item: MenuActiveOrder["items"][number], editable: boolean) => (
        <div key={item.id} className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
                <OrderLineItem
              name={item.name}
              variantNameSnapshot={item.variantNameSnapshot}
              modifiers={item.modifiers}
              quantity={item.quantity}
              unitPrice={item.unitPrice}
              totalPrice={item.totalPrice}
              notes={item.notes}
              kitchenNotes={item.kitchenNotes}
              className="text-[var(--pm-on-surface)]"
            />
            {!editable && (
              <p className="mt-1">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${kitchenStatusBadgeClass(item.kitchenStatus)}`}
                >
                  {formatKitchenStatusLabel(item.kitchenStatus)}
                </span>
              </p>
            )}
          </div>
          {editable ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={actionLoading}
                className="pm-press flex h-8 w-8 cursor-pointer items-center justify-center rounded-[var(--pm-radius-md)] border border-[var(--pm-outline-variant)]"
                onClick={() =>
                  staffActions &&
                  handleStaffAction(async () => {
                    if (item.quantity <= 1) return staffActions.removeItem(item.id);
                    return staffActions.updateQty(item.id, item.quantity - 1);
                  })
                }
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-6 text-center text-sm tabular-nums">{item.quantity}</span>
              <button
                type="button"
                disabled={actionLoading}
                className="pm-press flex h-8 w-8 cursor-pointer items-center justify-center rounded-[var(--pm-radius-md)] border border-[var(--pm-outline-variant)]"
                onClick={() =>
                  staffActions &&
                  handleStaffAction(() => staffActions.updateQty(item.id, item.quantity + 1))
                }
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                disabled={actionLoading}
                className="pm-press ml-1 cursor-pointer text-xs font-medium text-destructive"
                onClick={() =>
                  staffActions &&
                  handleStaffAction(() => staffActions.removeItem(item.id))
                }
              >
                Remove
              </button>
            </div>
          ) : (
            <span className="text-sm tabular-nums text-[var(--pm-on-surface-variant)]">×{item.quantity}</span>
          )}
        </div>
      );

      return (
        <div className="space-y-4 p-4">
          {staffPendingItems.length === 0 && previousOrderedItems.length === 0 ? (
            <p className="text-sm text-[var(--pm-on-surface-variant)]">
              No items yet. Tap + on menu items to add them.
            </p>
          ) : (
            <>
              {staffPendingItems.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--pm-on-surface-variant)]">
                    Current order
                  </p>
                  {staffPendingItems.map((item) => renderStaffItem(item, true))}
                </div>
              )}
              {previousOrderedItems.length > 0 && (
                <div className="space-y-3 border-t border-[var(--pm-outline-variant)] pt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--pm-on-surface-variant)]">
                    Previously ordered
                  </p>
                  {previousOrderedItems.map((item) => renderStaffItem(item, false))}
                </div>
              )}
            </>
          )}
          <div className="border-t border-[var(--pm-outline-variant)] pt-4">
            {liveOrder && (staffPendingItems.length > 0 || previousOrderedItems.length > 0) && (
              <div className="mb-4 flex justify-between text-sm font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{formatCurrency(liveOrder.total)}</span>
              </div>
            )}
            {staffActions && (
              <div className="space-y-2">
                {staffPendingItems.length > 0 && (
                  <>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() =>
                        handleStaffAction(() => staffActions.submitKitchen(), "Sent to kitchen")
                      }
                      className="pm-btn-primary w-full py-3"
                    >
                      {actionLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      Send to Kitchen
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading || billRequested}
                      onClick={() => void handleRequestBill()}
                      className="pm-btn-secondary w-full py-3 disabled:opacity-50"
                    >
                      <Receipt className="h-4 w-4" />
                      {billRequested ? "Bill Generated" : "Generate Bill"}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4 p-4">
        {cart.length === 0 && previousOrderedItems.length === 0 ? (
          <p className="text-sm text-[var(--pm-on-surface-variant)]">Your cart is empty.</p>
        ) : (
          <>
            {cart.length > 0 && (
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--pm-on-surface-variant)]">
                  New items
                </p>
                {cart.map((item) => {
                  const lineKey = getCartItemKey(item);
                  const priced = priceSelection(menuProductToConfigurable(item.product), {
                    variantId: item.variantId,
                    modifierIds: item.modifierIds,
                    quantity: item.quantity,
                  });
                  return (
                    <div key={lineKey} className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <OrderLineItem
                          name={item.product.name}
                          variantNameSnapshot={priced.variantName}
                          modifiers={priced.modifiers}
                          quantity={item.quantity}
                          unitPrice={priced.unitPrice}
                          totalPrice={priced.totalPrice}
                          notes={item.notes}
                          className="text-[var(--pm-on-surface)]"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          className="pm-press flex h-8 w-8 items-center justify-center rounded-[var(--pm-radius-md)] border border-[var(--pm-outline-variant)]"
                          onClick={() => updateCartQty(lineKey, -1)}
                          aria-label="Decrease quantity"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-6 text-center text-sm tabular-nums">{item.quantity}</span>
                        <button
                          type="button"
                          className="pm-press flex h-8 w-8 items-center justify-center rounded-[var(--pm-radius-md)] border border-[var(--pm-outline-variant)]"
                          onClick={() => updateCartQty(lineKey, 1)}
                          aria-label="Increase quantity"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="pm-press ml-1 text-xs font-medium text-destructive"
                          onClick={() => removeFromCart(lineKey)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {previousOrderedItems.length > 0 && (
              <div
                className={`space-y-3 ${cart.length > 0 ? "border-t border-[var(--pm-outline-variant)] pt-4" : ""}`}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--pm-on-surface-variant)]">
                  Previously ordered
                </p>
                {previousOrderedItems.map((item) => (
                  <div key={item.id} className="space-y-1.5">
                    <OrderLineItem
                      name={item.name}
                      variantNameSnapshot={item.variantNameSnapshot}
                      modifiers={item.modifiers}
                      quantity={item.quantity}
                      unitPrice={item.unitPrice}
                      totalPrice={item.totalPrice}
                      notes={item.notes}
                      className="text-[var(--pm-on-surface)]"
                    />
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${kitchenStatusBadgeClass(item.kitchenStatus)}`}
                    >
                      {formatKitchenStatusLabel(item.kitchenStatus)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {cart.length > 0 && mode === "customer" && (
          <div className="border-t border-[var(--pm-outline-variant)] pt-4">
            <div className="mb-4 flex justify-between text-sm font-semibold">
              <span>New items total</span>
              <span className="tabular-nums">{formatCurrency(cartTotal)}</span>
            </div>
            {liveOrder && previousOrderedItems.length > 0 && (
              <div className="mb-4 flex justify-between text-sm text-[var(--pm-on-surface-variant)]">
                <span>Session total so far</span>
                <span className="tabular-nums">{formatCurrency(liveOrder.total)}</span>
              </div>
            )}
            <button
              type="button"
              disabled={!canSubmitOrder || cart.length === 0 || submitting}
              onClick={handlePlaceOrder}
              className="pm-btn-primary w-full py-3"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Place Order
            </button>
          </div>
        )}
        {cart.length === 0 && liveOrder && previousOrderedItems.length > 0 && (
          <div className="border-t border-[var(--pm-outline-variant)] pt-4">
            <div className="flex justify-between text-sm font-semibold">
              <span>Session total</span>
              <span className="tabular-nums">{formatCurrency(liveOrder.total)}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const showOrderOverlay = canMutateOrder && activePanel === "order";
  const showServiceOverlay = canMutateOrder && activePanel === "service";
  const showBillOverlay = canMutateOrder && activePanel === "bill";

  return (
    <div className="min-h-screen bg-[var(--pm-surface)]" style={themeStyle}>
      <header
        className={`pm-header fixed ${menuHeaderTop} z-40 w-full border-b border-[var(--pm-outline-variant)]`}
        data-elevated={headerShadow}
      >
        {isStaffEmbedded && staffShell ? (
          <>
            <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between gap-3 px-4">
              <div className="min-w-0 flex-1">
                <h1 className="font-display truncate text-base tracking-tight text-[var(--pm-on-surface)] sm:text-lg">
                  {tableLabel || menu.restaurant.name}
                </h1>
                <p className="truncate text-xs text-[var(--pm-on-surface-variant)]">
                  {staffShell.restaurantName}
                  {guestCount ? ` · ${guestCount} guests` : ""}
                  {customerName ? ` · ${customerName}` : ""}
                  {` · ${staffShell.staffName} · ${staffShell.staffRole}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Link
                  href="/staff/floor"
                  className="pm-press inline-flex cursor-pointer items-center rounded-[var(--pm-radius-md)] px-2.5 py-1.5 text-xs font-medium text-[var(--pm-on-surface-variant)]"
                >
                  <LayoutGrid className="mr-1 h-3.5 w-3.5" />
                  Floor
                </Link>
                <StaffLogoutButton />
              </div>
            </div>
            <div className="relative border-t border-[var(--pm-outline-variant)] px-4 py-2.5">
              <Search className="pointer-events-none absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--pm-on-surface-variant)]" />
              <input
                type="search"
                placeholder="Search menu..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pm-input"
              />
            </div>
          </>
        ) : (
          <>
            <div
              className={`mx-auto flex ${menuHeaderHeight} max-w-[1280px] items-center justify-between gap-3 px-[var(--pm-margin-mobile)] md:px-[var(--pm-margin-desktop)]`}
            >
              <div className="min-w-0">
                <h1 className="font-display truncate text-lg tracking-tight text-[var(--pm-on-surface)] md:text-xl">
                  {menu.restaurant.name}
                </h1>
                {tableLabel && (
                  <p className="truncate text-xs text-[var(--pm-on-surface-variant)] sm:hidden">
                    {tableLabel}
                    {guestCount ? ` · ${guestCount} guests` : ""}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                {tableLabel && (
                  <span className="hidden rounded-full border border-[var(--pm-outline-variant)] bg-[var(--pm-surface-container-lowest)] px-3 py-1 text-xs font-medium text-[var(--pm-on-surface-variant)] sm:inline">
                    {tableLabel}
                    {guestCount ? ` · ${guestCount} guests` : ""}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setSearchOpen((v) => !v)}
                  className={`pm-icon-btn cursor-pointer ${searchOpen ? "bg-[var(--pm-surface-container)] text-[var(--pm-on-surface)]" : ""}`}
                  aria-label="Search menu"
                  aria-expanded={searchOpen}
                >
                  <Search className="h-5 w-5" />
                </button>
                {canMutateOrder && mode !== "staff" && orderTabBadge > 0 && (
                  <button
                    type="button"
                    className="pm-icon-btn relative cursor-pointer"
                    aria-label="View order"
                    onClick={() => setActivePanel("order")}
                  >
                    <ShoppingBag className="h-5 w-5" />
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--pm-secondary)] px-1 text-[10px] font-bold text-white">
                      {orderTabBadge}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {searchOpen && (
              <div className="relative border-t border-[var(--pm-outline-variant)] px-[var(--pm-margin-mobile)] py-3 md:px-[var(--pm-margin-desktop)]">
                <Search className="pointer-events-none absolute left-[calc(var(--pm-margin-mobile)+12px)] top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--pm-on-surface-variant)] md:left-[calc(var(--pm-margin-desktop)+12px)]" />
                <input
                  type="search"
                  placeholder="Search menu..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pm-input"
                  autoFocus
                />
              </div>
            )}
          </>
        )}
      </header>

      <div className={`flex min-h-screen ${contentTopPad}`}>
        <aside
          className={`${
            isStaffEmbedded ? "fixed left-0" : "sticky"
          } ${sidebarStickyTop} z-30 hidden ${sidebarHeight} w-56 shrink-0 flex-col border-r border-[var(--pm-outline-variant)] bg-[var(--pm-surface-container-lowest)] py-5 ${sidebarBreakpoint} xl:w-64`}
        >
          {!isStaffEmbedded && tableLabel && (
            <div className="mb-5 px-4">
              <div className="flex items-center gap-3 rounded-[var(--pm-radius-lg)] border border-[var(--pm-outline-variant)] bg-[var(--pm-surface)] p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-[var(--pm-radius-md)] bg-[var(--pm-primary-fixed)] text-[var(--pm-primary)]">
                  <Utensils className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--pm-on-surface)]">{tableLabel}</p>
                  {customerName && (
                    <p className="truncate text-xs text-[var(--pm-on-surface-variant)]">{customerName}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <p className="mb-2 px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--pm-on-surface-variant)]">
            Categories
          </p>
          <nav className="public-menu-scrollbar flex-1 space-y-0.5 overflow-y-auto px-2">
            {menu.categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => selectCategory(cat.id)}
                className={`pm-nav-item pm-press flex w-full cursor-pointer rounded-[var(--pm-radius-md)] px-3 py-2.5 text-left text-sm ${
                  activeCategory === cat.id && activePanel === "menu"
                    ? "bg-[var(--pm-primary-fixed)] font-semibold text-[var(--pm-primary)]"
                    : "font-medium text-[var(--pm-on-surface-variant)]"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </nav>

          {canMutateOrder && (
            <div className="mt-4 space-y-1 border-t border-[var(--pm-outline-variant)] px-2 pt-4">
              <button type="button" className={navBtnClass("order")} onClick={() => setActivePanel("order")}>
                <ShoppingBag className="h-4 w-4" />
                Order
                {orderTabBadge > 0 && (
                  <span className="ml-auto rounded-full bg-[var(--pm-secondary)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {orderTabBadge}
                  </span>
                )}
              </button>
              {mode === "customer" && (
                <button type="button" className={navBtnClass("service")} onClick={() => setActivePanel("service")}>
                  <Hand className="h-4 w-4" />
                  Service
                </button>
              )}
              <button type="button" className={navBtnClass("bill")} onClick={() => setActivePanel("bill")}>
                <Receipt className="h-4 w-4" />
                Bill
              </button>
              {mode === "customer" && (
                <button
                  type="button"
                  disabled={callingWaiter}
                  onClick={() => void handleCallWaiter()}
                  className="pm-btn-primary mt-3 w-full py-2.5 text-xs disabled:opacity-50"
                >
                  {callingWaiter ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Bell className="h-4 w-4" />
                  )}
                  Call Waiter
                </button>
              )}
            </div>
          )}
        </aside>

        <main
          className={`mx-auto min-w-0 max-w-[1024px] flex-1 ${
            isStaffEmbedded
              ? "px-4 pb-24 pt-2 md:ml-56 md:px-6 md:pb-8 md:pt-3 xl:ml-64"
              : "px-[var(--pm-margin-mobile)] py-6 md:px-[var(--pm-margin-desktop)] md:py-10"
          }`}
        >
          {orderingLocked && (
            <div className="mb-5 rounded-[var(--pm-radius-lg)] border border-amber-200/80 bg-amber-50 px-4 py-3 text-center text-sm text-amber-950">
              Waiting for restaurant approval — browse the menu while you wait
            </div>
          )}
          {!searchResults && activePanel === "menu" && !isStaffEmbedded && (
            <div className="mb-6 md:mb-8">
              <p className="mb-1.5 text-xs font-medium uppercase tracking-[0.12em] text-[var(--pm-on-surface-variant)]">
                {tableLabel ? `Dining at ${tableLabel}` : "Welcome"}
              </p>
              <h2 className="font-display max-w-2xl text-2xl leading-tight text-[var(--pm-on-surface)] md:text-3xl">
                {heroSubtitle}
              </h2>
            </div>
          )}

          {!searchResults && activePanel === "menu" && (
            <div
              className={`pm-category-rail pm-category-sticky public-menu-scrollbar sticky z-20 -mx-[var(--pm-margin-mobile)] px-[var(--pm-margin-mobile)] py-2 md:-mx-0 md:px-0 ${categoryPillsBreakpoint} ${
                isStaffEmbedded ? "mb-3 top-[7.25rem]" : "mb-6 top-16 md:top-20"
              }`}
            >
              {menu.categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => selectCategory(cat.id)}
                  data-active={activeCategory === cat.id}
                  className="pm-category-chip cursor-pointer"
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}

          {activePanel === "menu" && searchResults ? (
            <section>
              <div className="mb-5 flex items-end justify-between gap-3 border-b border-[var(--pm-outline-variant)] pb-3">
                <div>
                  <h3 className="font-display text-lg text-[var(--pm-on-surface)] md:text-xl">Search results</h3>
                  <p className="text-sm text-[var(--pm-on-surface-variant)]">
                    {searchResults.length} item{searchResults.length !== 1 ? "s" : ""} found
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                {searchResults.map((p) => renderProductCard(p))}
              </div>
              {searchResults.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Search className="mb-3 h-8 w-8 text-[var(--pm-outline)] opacity-50" />
                  <p className="text-sm font-medium text-[var(--pm-on-surface)]">No items found</p>
                  <p className="mt-1 text-sm text-[var(--pm-on-surface-variant)]">Try a different search term</p>
                </div>
              )}
            </section>
          ) : activePanel === "menu" ? (() => {
              const category = menu.categories.find((c) => c.id === activeCategory) ?? menu.categories[0];
              if (!category) {
                return (
                  <p className="py-12 text-center text-sm text-[var(--pm-on-surface-variant)]">
                    No categories available.
                  </p>
                );
              }
              const categoryProducts = getCategoryProducts(category.id);
              const loading = isCategoryLoading(category.id) && categoryProducts.length === 0;
              return (
              <section key={category.id} className="mb-10 md:mb-12">
                <div className="mb-4 flex flex-col items-start justify-between gap-1 border-b border-[var(--pm-outline-variant)] pb-3 sm:mb-5 sm:flex-row sm:items-end sm:gap-3">
                  <h3 className="font-display text-lg text-[var(--pm-on-surface)] md:text-xl">
                    {category.name}
                  </h3>
                  {category.description && (
                    <span className="text-xs text-[var(--pm-on-surface-variant)] sm:text-right">
                      {category.description}
                    </span>
                  )}
                </div>

                {loading ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={i}
                        className="overflow-hidden rounded-[var(--pm-radius-lg)] border border-[var(--pm-outline-variant)]"
                      >
                        <div className="aspect-[4/3] animate-pulse bg-[var(--pm-surface-container)]" />
                        <div className="space-y-2 p-3">
                          <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--pm-surface-container)]" />
                          <div className="h-3 w-1/3 animate-pulse rounded bg-[var(--pm-surface-container)]" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : categoryProducts.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                    {categoryProducts.map((p) => renderProductCard(p))}
                  </div>
                ) : (
                  <p className="rounded-[var(--pm-radius-lg)] border border-dashed border-[var(--pm-outline-variant)] px-4 py-8 text-center text-sm text-[var(--pm-on-surface-variant)]">
                    No items in this category yet.
                  </p>
                )}
              </section>
              );
            })()
          : null}
        </main>
      </div>

      {!isStaffEmbedded && (
      <footer className="mt-8 border-t border-[var(--pm-outline-variant)] bg-[var(--pm-surface-container-lowest)] pb-24 lg:pb-8">
        <div className="mx-auto flex max-w-[1280px] flex-col items-start justify-between gap-8 px-[var(--pm-margin-mobile)] py-10 md:flex-row md:px-[var(--pm-margin-desktop)]">
          <div className="max-w-md">
            <h4 className="font-display text-xl text-[var(--pm-on-surface)] md:text-2xl">
              {menu.restaurant.name}
            </h4>
            {branding?.about && (
              <p className="mt-2 text-sm leading-relaxed text-[var(--pm-on-surface-variant)]">
                {branding.about}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5 text-sm text-[var(--pm-on-surface-variant)] md:items-end md:text-right">
            {branding?.phone && <span>{branding.phone}</span>}
            {branding?.address && <span className="max-w-xs">{branding.address}</span>}
            {branding?.gstNumber && <span>GST: {branding.gstNumber}</span>}
            {branding?.socialLinks &&
              Object.entries(branding.socialLinks).some(([, url]) => url.trim()) && (
                <div className="flex flex-wrap gap-3 pt-2 md:justify-end">
                  {(Object.entries(branding.socialLinks) as [SocialLinkKey, string][])
                    .filter(([, url]) => url.trim())
                    .map(([key, url]) => (
                      <a
                        key={key}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="pm-press font-medium text-[var(--pm-primary)] underline-offset-4 hover:underline"
                      >
                        {SOCIAL_LINK_LABELS[key]}
                      </a>
                    ))}
                </div>
              )}
            <p className="pt-2 text-xs text-[var(--pm-on-surface-variant)]">
              © {new Date().getFullYear()} {menu.restaurant.name}
            </p>
          </div>
        </div>
      </footer>
      )}

      {selectedProduct && (
        <ProductConfiguratorSheet
          key={`cfg-${selectedProduct.id}`}
          product={menuProductToConfigurable(selectedProduct)}
          open={Boolean(selectedProduct)}
          onClose={() => setSelectedProduct(null)}
          onConfirm={(selection) => void handleConfiguratorConfirm(selection)}
          confirmLabel={mode === "staff" ? "Add to Order" : "Add to Cart"}
          showNotes={mode === "staff"}
          showConfirmButton={!isBrowseOnly && showOrderingAffordance && !selectedProduct.isOutOfStock}
          showQuantity={!isBrowseOnly}
        />
      )}

      {canMutateOrder && (
        <PublicMenuOrderChrome
          mode={mode}
          canOrder={canMutateOrder}
          cartCount={cartCount}
          orderBadgeCount={orderTabBadge}
          cartTotal={cartTotal}
          cartSummary={cart.map((item) => item.product.name).join(", ")}
          activePanel={activePanel}
          onActivePanelChange={setActivePanel}
          onCartOpen={() => setCartOpen(true)}
          onCartClose={() => setCartOpen(false)}
          cartOpen={cartOpen}
          orderPlaced={orderPlaced}
          onDismissOrderPlaced={() => setOrderPlaced(false)}
          customerName={customerName}
          showOrderOverlay={showOrderOverlay}
          showServiceOverlay={showServiceOverlay}
          showBillOverlay={showBillOverlay}
          submitting={submitting}
          callingWaiter={callingWaiter}
          actionLoading={actionLoading}
          billRequested={billRequested}
          onCallWaiter={() => void handleCallWaiter()}
          onRequestBill={() => void handleRequestBill()}
          activeOrderTotal={liveOrder?.total}
          trackingItems={
            mode === "customer"
              ? previousOrderedItems.map((item) => ({
                  id: item.id,
                  name: item.name,
                  billDisplayName: item.billDisplayName,
                  quantity: item.quantity,
                  kitchenStatus: item.kitchenStatus,
                }))
              : undefined
          }
          orderPanel={renderOrderPanel()}
        />
      )}
    </div>
  );
}
