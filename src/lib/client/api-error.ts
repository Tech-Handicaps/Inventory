/**
 * Shared client helper to read `{ error }` from API JSON responses.
 */
export async function apiErrorMessage(res: Response): Promise<string> {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) return "Request failed";
  try {
    const j = JSON.parse(trimmed) as { error?: string; detail?: string };
    return (
      (typeof j.error === "string" && j.error) ||
      (typeof j.detail === "string" && j.detail) ||
      "Request failed"
    );
  } catch {
    return "Server error";
  }
}

export async function readJsonOk<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res));
  }
  return (await res.json()) as T;
}
