// Server-side operational exports. Exact-count pagination fails closed on change.
import type { SupabaseClient } from "@supabase/supabase-js";
export type RecoveryRow = Record<string, unknown>;
export type RecoveryDocument = RecoveryRow & {
  id: string;
  private_object_key: string;
  application_id: string;
  workspace_id: string;
  status: string;
  hash: string | null;
};
export async function collectPages<T extends RecoveryRow>(
  fetchPage: (
    start: number,
    end: number,
  ) => Promise<{
    data: T[] | null;
    count: number | null;
    error: unknown;
  }>,
  key = "id",
  pageSize = 500,
) {
  const rows: T[] = [],
    seen = new Set<string>();
  let expected: number | undefined;
  for (let start = 0; ; start += pageSize) {
    const page = await fetchPage(start, start + pageSize - 1);
    if (
      page.error ||
      !page.data ||
      page.count === null ||
      !Number.isSafeInteger(page.count) ||
      page.count < 0
    )
      throw new Error("RECOVERY_QUERY_INCOMPLETE");
    expected ??= page.count;
    if (page.count !== expected)
      throw new Error("RECOVERY_CHANGED_DURING_EXPORT");
    for (const row of page.data) {
      const id = row[key];
      if (
        (typeof id !== "string" &&
          !(typeof id === "number" && Number.isSafeInteger(id))) ||
        seen.has(String(id))
      )
        throw new Error("RECOVERY_ROW_INTEGRITY");
      seen.add(String(id));
      rows.push(row);
    }
    if (rows.length === expected) return rows;
    if (rows.length > expected || page.data.length < pageSize)
      throw new Error("RECOVERY_QUERY_TRUNCATED");
  }
}
export function pagedRows<T extends RecoveryRow = RecoveryRow>(
  db: SupabaseClient,
  table: string,
  filters: Record<string, string | null>,
  key = "id",
  columns = "*",
) {
  return collectPages<T>(async (start, end) => {
    let query = db.from(table).select(columns, { count: "exact" });
    for (const [column, value] of Object.entries(filters))
      query = value === null ? query.is(column, null) : query.eq(column, value);
    const result = await query.order(key).range(start, end);
    return {
      data: result.data as T[] | null,
      count: result.count,
      error: result.error,
    };
  }, key);
}
