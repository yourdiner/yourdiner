type ApiResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

type QRRecord = {
  id: string;
  url: string;
  mode: string;
  token: string;
  createdAt: Date;
  invalidatedAt: Date | null;
};

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

export async function generateMenuQR(): Promise<ApiResult<QRRecord>> {
  const res = await fetch("/api/admin/qr-codes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "generate" }),
  });
  return parseJson(res);
}

export async function regenerateQR(qrCodeId: string): Promise<ApiResult<QRRecord>> {
  const res = await fetch("/api/admin/qr-codes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "regenerate", qrCodeId }),
  });
  return parseJson(res);
}

export async function invalidateQR(qrCodeId: string): Promise<ApiResult> {
  const res = await fetch("/api/admin/qr-codes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "invalidate", qrCodeId }),
  });
  return parseJson(res);
}

export async function generateQRImageDataUrl(url: string): Promise<string | null> {
  const res = await fetch(`/api/admin/qr-codes?url=${encodeURIComponent(url)}`);
  const result = await parseJson<{ dataUrl: string }>(res);
  return result.ok ? result.data.dataUrl : null;
}

export async function searchPublicMenu(restaurantId: string, query: string) {
  const res = await fetch(
    `/api/public/menu/search?restaurantId=${encodeURIComponent(restaurantId)}&q=${encodeURIComponent(query)}`
  );
  if (!res.ok) return [];
  return res.json();
}

export async function fetchPublicCategoryProducts(categoryId: string) {
  const res = await fetch(`/api/public/menu/categories/${encodeURIComponent(categoryId)}/products`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchPublicProductConfig(productId: string) {
  const res = await fetch(`/api/public/menu/products/${encodeURIComponent(productId)}/config`);
  if (!res.ok) return null;
  return res.json();
}

export async function fetchStaffCategoryProducts(categoryId: string) {
  const res = await fetch(
    `/api/menu/catalog?categoryId=${encodeURIComponent(categoryId)}`,
    { credentials: "include" }
  );
  if (!res.ok) return [];
  return res.json();
}

export async function fetchStaffProductConfig(productId: string) {
  const res = await fetch(
    `/api/menu/catalog?productId=${encodeURIComponent(productId)}`,
    { credentials: "include" }
  );
  if (!res.ok) return null;
  return res.json();
}

export async function searchStaffMenu(query: string) {
  const res = await fetch(
    `/api/menu/catalog?q=${encodeURIComponent(query)}`,
    { credentials: "include" }
  );
  if (!res.ok) return [];
  return res.json();
}
