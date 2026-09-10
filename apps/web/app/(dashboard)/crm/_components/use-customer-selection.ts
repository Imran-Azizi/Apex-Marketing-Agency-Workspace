"use client";

import { useCallback, useMemo, useState } from "react";

export function useCustomerSelection(selectablePageIds: string[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(),
  );

  const selectedOnPage = useMemo(
    () => selectablePageIds.filter((id) => selectedIds.has(id)),
    [selectablePageIds, selectedIds],
  );

  const allPageSelected =
    selectablePageIds.length > 0 &&
    selectedOnPage.length === selectablePageIds.length;
  const somePageSelected = selectedOnPage.length > 0 && !allPageSelected;
  const selectedCount = selectedIds.size;
  const selectAllState: boolean | "indeterminate" = allPageSelected
    ? true
    : somePageSelected
      ? "indeterminate"
      : false;

  const toggleRow = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const toggleAllOnPage = useCallback(
    (checked: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of selectablePageIds) {
          if (checked) next.add(id);
          else next.delete(id);
        }
        return next;
      });
    },
    [selectablePageIds],
  );

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const removeIds = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  }, []);

  return {
    selectedIds,
    selectedCount,
    selectAllState,
    toggleRow,
    toggleAllOnPage,
    clearSelection,
    removeIds,
  };
}
