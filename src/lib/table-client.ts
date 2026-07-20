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

export async function getNextTableNumber(): Promise<ApiResult<{ number: number }>> {
  const res = await fetch("/api/admin/tables");
  return parseJson(res);
}

export async function createTable(body: unknown): Promise<ApiResult<{ id: string }>> {
  const res = await fetch("/api/admin/tables", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function updateTable(id: string, data: unknown): Promise<ApiResult<{ id: string }>> {
  const res = await fetch("/api/admin/tables", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, data }),
  });
  return parseJson(res);
}

export async function deleteTable(id: string): Promise<ApiResult> {
  const res = await fetch(`/api/admin/tables?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  return parseJson(res);
}

export async function generateTableCustomerQr(
  tableId: string
): Promise<ApiResult<{ url: string; qrSlug: string; permanent: boolean }>> {
  const res = await fetch(`/api/admin/tables/${tableId}/customer-qr`, { method: "POST" });
  return parseJson(res);
}

export async function resetTable(tableId: string): Promise<ApiResult> {
  const res = await fetch(`/api/admin/tables/${tableId}/reset`, { method: "POST" });
  return parseJson(res);
}
