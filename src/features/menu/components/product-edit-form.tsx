"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { productSchema, type ProductInput } from "@/features/menu/schemas";
import { updateProduct, deleteProduct } from "@/lib/menu-client";
import { ProductImagesSection } from "@/features/menu/components/product-images-section";
import { VariantGroupsEditor } from "@/features/menu/components/variant-groups-editor";
import { ModifierGroupsEditor } from "@/features/menu/components/modifier-groups-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RequiredLabel } from "@/components/ui/required-label";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { formatCurrency, paiseToRupees, rupeesToPaise } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

type ProductFormValues = Omit<ProductInput, "price" | "discountPrice"> & {
  price: number;
};

interface ProductEditFormProps {
  product: {
    id: string;
    name: string;
    categoryId: string;
    shortDescription: string | null;
    description: string | null;
    price: number;
    discountPrice: number | null;
    dietaryType: string;
    spicyLevel: number;
    prepTimeMinutes: number | null;
    isAvailable: boolean;
    isOutOfStock: boolean;
    isSeasonal: boolean;
    isFeatured: boolean;
    isRecommended: boolean;
    isChefSpecial: boolean;
    isBestSeller: boolean;
    isHidden: boolean;
    calories: number | null;
    allergens: string[];
    sku: string | null;
    barcode: string | null;
    searchKeywords: string[];
    variantGroups: Array<{
      id: string;
      name: string;
      isRequired: boolean;
      variants: Array<{ id: string; name: string; price: number; isActive: boolean; groupId?: string | null }>;
    }>;
    variants: Array<{ id: string; name: string; price: number; isActive: boolean }>;
    modifierGroups: Array<{
      group: {
        id: string;
        name: string;
        minSelect: number;
        maxSelect: number;
        isRequired: boolean;
        modifiers: Array<{ id: string; name: string; price: number }>;
      };
    }>;
    images?: Array<{ id: string; isPrimary: boolean; media: { id: string; url: string } }>;
  };
  categories: Array<{ id: string; name: string }>;
  availableModifierGroups: Array<{
    id: string;
    name: string;
    minSelect: number;
    maxSelect: number;
    isRequired: boolean;
    modifiers: Array<{ id: string; name: string; price: number }>;
  }>;
}

export function ProductEditForm({ product, categories, availableModifierGroups }: ProductEditFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const form = useForm<ProductFormValues>({
    defaultValues: {
      categoryId: product.categoryId,
      name: product.name,
      shortDescription: product.shortDescription || "",
      description: product.description || "",
      price: paiseToRupees(product.price),
      dietaryType: product.dietaryType as ProductInput["dietaryType"],
      spicyLevel: product.spicyLevel,
      prepTimeMinutes: product.prepTimeMinutes,
      isAvailable: product.isAvailable,
      isOutOfStock: product.isOutOfStock,
      isSeasonal: product.isSeasonal,
      isFeatured: product.isFeatured,
      isRecommended: product.isRecommended,
      isChefSpecial: product.isChefSpecial,
      isBestSeller: product.isBestSeller,
      isHidden: product.isHidden,
      calories: product.calories,
      allergens: product.allergens,
      sku: product.sku || "",
      barcode: product.barcode || "",
      searchKeywords: product.searchKeywords,
    },
  });

  const onSubmit = async (raw: ProductFormValues) => {
    setLoading(true);
    try {
      const data = productSchema.parse({
        ...raw,
        price: rupeesToPaise(raw.price),
        discountPrice: null,
      });
      const result = await updateProduct(product.id, data);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Product updated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this product?")) return;
    try {
      const result = await deleteProduct(product.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Product deleted");
      router.push("/admin/products");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    }
  };

  const priceInRupees = form.watch("price");
  const linkedModifierGroups = product.modifierGroups.map((pmg) => pmg.group);

  return (
    <div className="space-y-6">
      <Link href="/admin/products" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Back to Products
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Images</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductImagesSection productId={product.id} images={product.images ?? []} />
        </CardContent>
      </Card>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Info</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <RequiredLabel>Name</RequiredLabel>
              <Input {...form.register("name")} />
            </div>
            <div className="space-y-2">
              <RequiredLabel>Category</RequiredLabel>
              <Select
                value={form.watch("categoryId")}
                onValueChange={(v) => form.setValue("categoryId", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <RequiredLabel>Base Price (₹)</RequiredLabel>
              <Input type="number" step="0.01" min={0} {...form.register("price", { valueAsNumber: true })} />
              <p className="text-xs text-muted-foreground">
                {formatCurrency(rupeesToPaise(priceInRupees || 0))} — used when no variant is selected
              </p>
            </div>
            <div className="space-y-2">
              <Label>Dietary Type</Label>
              <Select
                value={form.watch("dietaryType")}
                onValueChange={(v) => form.setValue("dietaryType", v as ProductInput["dietaryType"])}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="VEG">Veg</SelectItem>
                  <SelectItem value="NON_VEG">Non-Veg</SelectItem>
                  <SelectItem value="EGG">Egg</SelectItem>
                  <SelectItem value="VEGAN">Vegan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Spicy Level (0-5)</Label>
              <Input type="number" min={0} max={5} {...form.register("spicyLevel", { valueAsNumber: true })} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Short Description</Label>
              <Input {...form.register("shortDescription")} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Description</Label>
              <Textarea {...form.register("description")} rows={3} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Flags & Availability</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            {[
              ["isAvailable", "Available"],
              ["isOutOfStock", "Out of Stock"],
              ["isSeasonal", "Seasonal"],
              ["isFeatured", "Featured"],
              ["isRecommended", "Recommended"],
              ["isChefSpecial", "Chef Special"],
              ["isBestSeller", "Best Seller"],
              ["isHidden", "Hidden"],
            ].map(([field, label]) => (
              <div key={field} className="flex items-center gap-2">
                <Switch
                  checked={form.watch(field as keyof ProductFormValues) as boolean}
                  onCheckedChange={(v) => form.setValue(field as keyof ProductFormValues, v as never)}
                />
                <Label>{label}</Label>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Variant Groups</CardTitle>
            <p className="text-sm text-muted-foreground">
              Variant prices are absolute replacement prices, not add-ons to the base price.
            </p>
          </CardHeader>
          <CardContent>
            <VariantGroupsEditor
              productId={product.id}
              variantGroups={product.variantGroups}
              legacyVariants={product.variants}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Modifier Groups</CardTitle>
            <p className="text-sm text-muted-foreground">
              Link reusable modifier groups (toppings, extras) to this product.
            </p>
          </CardHeader>
          <CardContent>
            <ModifierGroupsEditor
              productId={product.id}
              linkedGroups={linkedModifierGroups}
              availableGroups={availableModifierGroups}
            />
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </Button>
          <Button type="button" variant="destructive" onClick={handleDelete}>
            Delete Product
          </Button>
        </div>
      </form>
    </div>
  );
}
