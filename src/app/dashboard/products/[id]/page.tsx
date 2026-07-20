import { notFound } from "next/navigation";
import { getProductById, getCategories, getModifierGroups } from "@/features/menu/actions";
import { ProductEditForm } from "@/features/menu/components/product-edit-form";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let product;
  try {
    product = await getProductById(id);
  } catch {
    notFound();
  }

  const [categories, modifierGroups] = await Promise.all([
    getCategories(),
    getModifierGroups(),
  ]);

  const availableModifierGroups = modifierGroups.map((g) => ({
    id: g.id,
    name: g.name,
    minSelect: g.minSelect,
    maxSelect: g.maxSelect,
    isRequired: g.isRequired,
    modifiers: g.modifiers.map((m) => ({ id: m.id, name: m.name, price: m.price })),
  }));

  return (
    <div>
      <div className="border-b px-8 py-4">
        <h1 className="text-2xl font-bold">{product.name}</h1>
        <p className="text-muted-foreground">Edit product details</p>
      </div>
      <div className="p-6">
        <ProductEditForm
          product={product}
          categories={categories}
          availableModifierGroups={availableModifierGroups}
        />
      </div>
    </div>
  );
}
