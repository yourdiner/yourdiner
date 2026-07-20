"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useServerSyncedState } from "@/hooks/use-server-synced-state";
import Link from "next/link";
import {
  duplicateProduct,
  toggleProductVisibility,
  exportMenuToExcel,
  createProduct,
  deleteProduct,
} from "@/lib/menu-client";
import { uploadProductImage } from "@/lib/media-client";
import { ProductImagePicker } from "@/features/menu/components/product-image-picker";
import { RequiredLabel } from "@/components/ui/required-label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MaterialIcon } from "@/components/layout/material-icon";
import { toast } from "sonner";
import { formatCurrency, rupeesToPaise } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  price: number;
  discountPrice: number | null;
  shortDescription: string | null;
  dietaryType: string;
  isAvailable: boolean;
  isHidden: boolean;
  isFeatured: boolean;
  isBestSeller: boolean;
  category: { name: string };
  variants: Array<{ id: string; name: string; price: number }>;
  images?: Array<{ media: { url: string } }>;
}

interface Category {
  id: string;
  name: string;
}

export function ProductsManager({
  products: initial,
  categories,
  total,
  page,
  pageSize,
  search: initialSearch,
  categoryId: initialCategoryId,
  sort: initialSort,
}: {
  products: Product[];
  categories: Category[];
  total: number;
  page: number;
  pageSize: number;
  search: string;
  categoryId: string;
  sort: "default" | "price_asc" | "price_desc";
  activeCount?: number;
  draftCount?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [products, setProducts] = useServerSyncedState(initial);
  const [search, setSearch] = useState(initialSearch);
  const [categoryFilter, setCategoryFilter] = useState(initialCategoryId);
  const [sortAsc, setSortAsc] = useState(initialSort !== "price_desc");
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSearch(initialSearch);
    setCategoryFilter(initialCategoryId);
    setSortAsc(initialSort !== "price_desc");
  }, [initialSearch, initialCategoryId, initialSort]);

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  const updateQuery = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (!value || value === "all" || (key === "sort" && value === "default")) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    if (!updates.page) {
      params.delete("page");
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      updateQuery({ search: value.trim() || undefined, page: undefined });
    }, 300);
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    name: "",
    categoryId: categories[0]?.id || "",
    price: 0,
    shortDescription: "",
    dietaryType: "VEG",
  });

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error("Product name is required");
      return;
    }
    if (!form.categoryId) {
      toast.error("Category is required");
      return;
    }
    if (form.price <= 0) {
      toast.error("Price must be greater than 0");
      return;
    }

    setLoading(true);
    try {
      const result = await createProduct({
        ...form,
        price: rupeesToPaise(form.price),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      if (imageFile && result.data?.id) {
        const uploadResult = await uploadProductImage(result.data.id, imageFile, true);
        if (!uploadResult.ok) {
          toast.error(`Product created but image upload failed: ${uploadResult.error}`);
        }
      }

      toast.success("Product created");
      setOpen(false);
      setImageFile(null);
      setForm({
        name: "",
        categoryId: categories[0]?.id || "",
        price: 0,
        shortDescription: "",
        dietaryType: "VEG",
      });
      router.refresh();
    } catch {
      toast.error("Failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    try {
      const result = await deleteProduct(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setProducts(products.filter((p) => p.id !== id));
      toast.success("Deleted");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      const result = await duplicateProduct(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Product duplicated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    }
  };

  const handleToggleVisibility = async (id: string) => {
    try {
      const result = await toggleProductVisibility(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setProducts(
        products.map((p) => (p.id === id ? { ...p, isHidden: result.data.isHidden } : p))
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    }
  };

  const handleExport = async () => {
    try {
      const result = await exportMenuToExcel();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const link = document.createElement("a");
      link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${result.data.base64}`;
      link.download = "menu-export.xlsx";
      link.click();
      toast.success("Menu exported");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    }
  };

  const uniqueCategories = categories;

  return (
    <div>
      {/* Action Bar */}
      <div className="mb-admin-lg flex flex-col justify-between gap-admin-md md:flex-row md:items-center">
        <div className="flex flex-wrap gap-4">
          <Select
            value={categoryFilter}
            onValueChange={(value) => {
              setCategoryFilter(value);
              updateQuery({
                category: value === "all" ? undefined : value,
                page: undefined,
              });
            }}
          >
            <SelectTrigger className="w-auto gap-2 border-tertiary-fixed bg-white px-6 py-2 text-label-md text-on-surface-variant">
              <MaterialIcon name="filter_list" className="text-sm" />
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {uniqueCategories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            type="button"
            onClick={() => {
              const nextSort = sortAsc ? "price_desc" : "price_asc";
              setSortAsc(!sortAsc);
              updateQuery({ sort: nextSort, page: undefined });
            }}
            className="flex items-center gap-2 border border-tertiary-fixed bg-white px-6 py-2 text-label-md text-on-surface-variant transition-colors hover:bg-surface-container-low"
          >
            <MaterialIcon name="sort" className="text-sm" />
            Price: {sortAsc ? "Low to High" : "High to Low"}
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-2 border border-tertiary-fixed bg-white px-6 py-2 text-label-md text-on-surface-variant transition-colors hover:bg-surface-container-low"
          >
            <MaterialIcon name="download" className="text-sm" />
            Export
          </button>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              className="group flex items-center gap-3 bg-primary px-admin-xl py-4 text-label-md text-on-primary quiet-shadow transition-all hover:-translate-y-0.5"
            >
              <MaterialIcon
                name="add"
                className="text-on-primary transition-transform duration-300 group-hover:rotate-90"
              />
              ADD NEW ITEM
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-lg border-tertiary-fixed">
            <DialogHeader>
              <DialogTitle className="font-display text-headline-sm">New Product</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <RequiredLabel>Name</RequiredLabel>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <RequiredLabel>Category</RequiredLabel>
                <Select
                  value={form.categoryId}
                  onValueChange={(v) => setForm({ ...form, categoryId: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <RequiredLabel>Price (₹)</RequiredLabel>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <RequiredLabel required={false}>Dietary</RequiredLabel>
                  <Select
                    value={form.dietaryType}
                    onValueChange={(v) => setForm({ ...form, dietaryType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="VEG">Veg</SelectItem>
                      <SelectItem value="NON_VEG">Non-Veg</SelectItem>
                      <SelectItem value="EGG">Egg</SelectItem>
                      <SelectItem value="VEGAN">Vegan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <RequiredLabel required={false}>Product Image</RequiredLabel>
                <ProductImagePicker file={imageFile} onFileChange={setImageFile} disabled={loading} />
              </div>
              <div className="space-y-2">
                <RequiredLabel required={false}>Short Description</RequiredLabel>
                <Textarea
                  value={form.shortDescription}
                  onChange={(e) => setForm({ ...form, shortDescription: e.target.value })}
                />
              </div>
              <Button onClick={handleCreate} disabled={loading} className="w-full">
                {loading ? "Creating..." : "Create Product"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search (mobile) */}
      <div className="relative mb-admin-md lg:hidden">
        <MaterialIcon
          name="search"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
        />
        <input
          className="w-full border border-tertiary-fixed bg-surface py-2 pl-10 pr-4 text-label-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          placeholder="Search products..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
      </div>

      {/* Menu Table */}
      <div className="overflow-hidden border border-tertiary-fixed bg-white quiet-shadow">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-tertiary-fixed bg-surface-container-low">
              <th className="px-admin-md py-4 text-label-md uppercase tracking-wider text-tertiary">
                Item Details
              </th>
              <th className="px-admin-md py-4 text-label-md uppercase tracking-wider text-tertiary">
                Category
              </th>
              <th className="px-admin-md py-4 text-right text-label-md uppercase tracking-wider text-tertiary">
                Price
              </th>
              <th className="px-admin-md py-4 text-center text-label-md uppercase tracking-wider text-tertiary">
                Status
              </th>
              <th className="px-admin-md py-4 text-right text-label-md uppercase tracking-wider text-tertiary">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-tertiary-fixed">
            {products.map((product) => {
              const imageUrl = product.images?.[0]?.media?.url;
              const isDraft = product.isHidden || !product.isAvailable;
              return (
                <tr key={product.id} className="item-row bg-white">
                  <td className="px-admin-md py-6">
                    <div className="flex items-center gap-4">
                      <div className="h-20 w-16 shrink-0 overflow-hidden bg-surface-container">
                        {imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={imageUrl}
                            alt={product.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <MaterialIcon name="restaurant" className="text-primary-fixed-dim" />
                          </div>
                        )}
                      </div>
                      <div>
                        <Link
                          href={`/admin/products/${product.id}`}
                          className="font-display text-headline-sm leading-tight text-on-surface hover:text-primary"
                        >
                          {product.name}
                        </Link>
                        {product.shortDescription && (
                          <p className="text-label-sm text-on-surface-variant opacity-60">
                            {product.shortDescription}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-admin-md py-6">
                    <span className="bg-surface-container-low px-3 py-1 text-label-sm uppercase tracking-tighter text-tertiary">
                      {product.category.name}
                    </span>
                  </td>
                  <td className="px-admin-md py-6 text-right text-label-md text-on-surface">
                    {formatCurrency(product.price)}
                  </td>
                  <td className="px-admin-md py-6 text-center">
                    {isDraft ? (
                      <span className="rounded-full bg-tertiary-fixed px-4 py-1 text-label-sm text-tertiary">
                        Draft
                      </span>
                    ) : (
                      <span className="rounded-full bg-on-primary-container px-4 py-1 text-label-sm text-primary-container">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-admin-md py-6 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/admin/products/${product.id}`}
                        className="p-2 text-on-surface-variant transition-colors hover:text-primary"
                      >
                        <MaterialIcon name="edit" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleToggleVisibility(product.id)}
                        className="p-2 text-on-surface-variant transition-colors hover:text-primary"
                        title={product.isHidden ? "Show on menu" : "Hide from menu"}
                      >
                        <MaterialIcon name={product.isHidden ? "visibility" : "visibility_off"} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicate(product.id)}
                        className="p-2 text-on-surface-variant transition-colors hover:text-primary"
                        title="Duplicate"
                      >
                        <MaterialIcon name="content_copy" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(product.id)}
                        className="p-2 text-on-surface-variant transition-colors hover:text-error"
                        title="Delete"
                      >
                        <MaterialIcon name="delete" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {products.length === 0 && (
          <p className="p-8 text-center text-on-surface-variant">No products found</p>
        )}

        <div className="flex items-center justify-between border-t border-tertiary-fixed bg-surface p-admin-md">
          <p className="text-label-sm text-on-surface-variant">
            Showing {products.length} of {total} menu items
            {totalPages > 1 ? ` · Page ${page} of ${totalPages}` : ""}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => updateQuery({ page: String(page - 1) })}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => updateQuery({ page: String(page + 1) })}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
