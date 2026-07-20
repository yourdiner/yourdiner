type ApiResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

async function parseJson<T>(res: Response): Promise<ApiResult<T>> {
  const text = await res.text();
  try {
    const data = JSON.parse(text) as ApiResult<T>;
    if (!res.ok && !("error" in data)) {
      return { ok: false, error: text.slice(0, 200) || "Request failed" };
    }
    return data;
  } catch {
    return { ok: false, error: text.slice(0, 200) || `Request failed (${res.status})` };
  }
}

export async function updateProduct(
  productId: string,
  body: unknown
): Promise<ApiResult<{ id: string }>> {
  const res = await fetch(`/api/admin/products/${productId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function deleteProduct(productId: string): Promise<ApiResult> {
  const res = await fetch(`/api/admin/products/${productId}`, { method: "DELETE" });
  return parseJson(res);
}

export async function createProduct(body: unknown): Promise<ApiResult<{ id: string }>> {
  const res = await fetch("/api/admin/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function addProductVariant(
  productId: string,
  body: unknown
): Promise<ApiResult<{ id: string }>> {
  const res = await fetch(`/api/admin/products/${productId}/variants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function deleteProductVariant(variantId: string): Promise<ApiResult> {
  const res = await fetch(`/api/admin/products/variants/${variantId}`, { method: "DELETE" });
  return parseJson(res);
}

export async function duplicateProduct(productId: string): Promise<ApiResult<{ id: string }>> {
  const res = await fetch(`/api/admin/products/${productId}/duplicate`, { method: "POST" });
  return parseJson(res);
}

export async function toggleProductVisibility(
  productId: string
): Promise<ApiResult<{ isHidden: boolean }>> {
  const res = await fetch(`/api/admin/products/${productId}/visibility`, { method: "POST" });
  return parseJson(res);
}

export async function exportMenuToExcel(): Promise<ApiResult<{ base64: string }>> {
  const res = await fetch("/api/admin/menu/export");
  return parseJson(res);
}

export async function createCategory(body: unknown): Promise<ApiResult<{ id: string }>> {
  const res = await fetch("/api/admin/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function deleteCategory(categoryId: string): Promise<ApiResult> {
  const res = await fetch(`/api/admin/categories/${categoryId}`, { method: "DELETE" });
  return parseJson(res);
}

export async function reorderCategories(items: Array<{ id: string; sortOrder: number }>): Promise<ApiResult> {
  const res = await fetch("/api/admin/categories/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  return parseJson(res);
}
