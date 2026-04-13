import { useState, useMemo, useEffect } from "react";

export function usePagination(items, pageSize = 20) {
  const [page, setPage] = useState(1);

  // Resetear a página 1 cuando cambia la lista (nueva búsqueda)
  useEffect(() => {
    setPage(1);
  }, [items]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  return { page, setPage, totalPages, pageItems };
}
