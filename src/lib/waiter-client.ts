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

export async function createWaiter(
  body: unknown
): Promise<ApiResult<{ id: string; defaultPassword?: string }>> {
  const res = await fetch("/api/admin/waiters", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function updateWaiter(
  id: string,
  data: unknown
): Promise<ApiResult<{ id: string; defaultPassword?: string }>> {
  const res = await fetch("/api/admin/waiters", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, data }),
  });
  return parseJson(res);
}

export async function deactivateWaiter(id: string): Promise<ApiResult> {
  const res = await fetch(`/api/admin/waiters?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  return parseJson(res);
}
