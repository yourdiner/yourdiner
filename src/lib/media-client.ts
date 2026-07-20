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

export async function uploadProductImage(
  productId: string,
  file: File,
  isPrimary: boolean
): Promise<ApiResult<{ productImageId: string; url: string }>> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("isPrimary", String(isPrimary));

  const res = await fetch(`/api/admin/products/${productId}/images`, {
    method: "POST",
    body: formData,
  });
  return parseJson(res);
}

export async function removeProductImage(imageId: string): Promise<ApiResult<void>> {
  const res = await fetch(`/api/admin/product-images/${imageId}`, { method: "DELETE" });
  return parseJson(res);
}

export async function uploadBrandingImage(
  type: "logo" | "cover" | "favicon",
  file: File
): Promise<ApiResult<{ url: string }>> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", type);

  const res = await fetch("/api/admin/branding/image", {
    method: "POST",
    body: formData,
  });
  return parseJson(res);
}
