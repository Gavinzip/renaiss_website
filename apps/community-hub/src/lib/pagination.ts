import { useEffect, useMemo, useState } from "react";

export const CONTENT_PAGE_SIZE = 12;

export function usePaginatedRows<T>(rows: T[], resetKey: string, pageSize = CONTENT_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));

  useEffect(() => setPage(1), [resetKey]);
  useEffect(() => setPage((current) => Math.min(current, pageCount)), [pageCount]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [page, pageSize, rows]);

  return { page, pageCount, pageRows, setPage };
}
