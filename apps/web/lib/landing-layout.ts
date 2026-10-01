import {
  cloneBlock,
  createElement,
  defaultElementStyles,
  newBlockId,
  type LandingElement,
  type LandingSection,
} from "@/lib/landing-content";

export const MAX_ROW_COLUMNS = 4;

export type DropPosition = "before" | "after" | "left" | "right" | "end";

export type ElementPath = {
  sectionId: string;
  /** Indices into nested lists: [topIndex] or [columnsParentIndex, colIndex, childIndex] */
  indices: number[];
  /** Which section list: flat elements or section.columns */
  list: "elements" | "section-columns";
  sectionColumnIndex?: number;
};

function isRow(el: LandingElement | null | undefined): boolean {
  return !!el && (el.type === "columns" || el.type === "grid");
}

function rowCount(el: LandingElement): number {
  if (el.type === "grid") {
    return Math.min(
      MAX_ROW_COLUMNS,
      Math.max(1, Number(el.content.columns) || el.columns?.length || 1),
    );
  }
  return Math.min(
    MAX_ROW_COLUMNS,
    Math.max(2, Number(el.content.count) || el.columns?.length || 2),
  );
}

export function createRow(
  columns: LandingElement[][],
): LandingElement {
  const count = Math.min(MAX_ROW_COLUMNS, Math.max(2, columns.length));
  const padded = Array.from({ length: count }, (_, i) =>
    cloneBlock(columns[i] || []),
  );
  return {
    id: newBlockId("columns"),
    type: "columns",
    content: { count },
    styles: defaultElementStyles({ gap: 16, marginBottom: 12 }),
    columns: padded,
  };
}

function syncRowMeta(row: LandingElement): LandingElement {
  const cols = (row.columns || []).filter((col) => col.length > 0);
  if (cols.length <= 1) {
    // Unwrap: return first child or empty sentinel handled by caller
    return row;
  }
  const count = Math.min(MAX_ROW_COLUMNS, cols.length);
  return {
    ...row,
    type: "columns",
    content: { ...row.content, count },
    columns: cols.slice(0, count),
  };
}

function unwrapIfNeeded(el: LandingElement): LandingElement[] {
  if (!isRow(el)) return [el];
  const cols = (el.columns || []).filter((c) => c.length > 0);
  if (cols.length === 0) return [];
  if (cols.length === 1) return cols[0];
  return [syncRowMeta({ ...el, columns: cols })];
}

function getList(
  section: LandingSection,
  list: ElementPath["list"],
  sectionColumnIndex?: number,
): LandingElement[] {
  if (list === "section-columns") {
    return section.columns?.[sectionColumnIndex ?? 0] || [];
  }
  return section.elements || [];
}

function setList(
  section: LandingSection,
  list: ElementPath["list"],
  next: LandingElement[],
  sectionColumnIndex?: number,
): LandingSection {
  if (list === "section-columns" && section.columns) {
    const columns = section.columns.map((col, i) =>
      i === (sectionColumnIndex ?? 0) ? next : col,
    );
    return { ...section, columns };
  }
  return { ...section, elements: next };
}

export function findElementPath(
  section: LandingSection,
  elementId: string,
): ElementPath | null {
  const walk = (
    list: LandingElement[],
    listKind: ElementPath["list"],
    sectionColumnIndex: number | undefined,
    prefix: number[],
  ): ElementPath | null => {
    for (let i = 0; i < list.length; i++) {
      const el = list[i];
      if (el.id === elementId) {
        return {
          sectionId: section.id,
          indices: [...prefix, i],
          list: listKind,
          sectionColumnIndex,
        };
      }
      if (isRow(el) && el.columns) {
        for (let c = 0; c < el.columns.length; c++) {
          const found = walk(el.columns[c], listKind, sectionColumnIndex, [
            ...prefix,
            i,
            c,
          ]);
          if (found) return found;
        }
      }
    }
    return null;
  };

  const inElements = walk(section.elements || [], "elements", undefined, []);
  if (inElements) return inElements;

  if (section.columns) {
    for (let c = 0; c < section.columns.length; c++) {
      const found = walk(section.columns[c], "section-columns", c, []);
      if (found) return found;
    }
  }
  return null;
}

export function extractElement(
  section: LandingSection,
  elementId: string,
): { section: LandingSection; element: LandingElement } | null {
  const path = findElementPath(section, elementId);
  if (!path) return null;

  let extracted: LandingElement | null = null;

  const removeFromList = (list: LandingElement[], indices: number[]): LandingElement[] => {
    if (indices.length === 1) {
      const idx = indices[0];
      const el = list[idx];
      if (!el) return list;
      extracted = el;
      return [...list.slice(0, idx), ...list.slice(idx + 1)];
    }

    // Nested inside a row: [rowIndex, colIndex, childIndex, ...]
    const [rowIndex, colIndex, ...rest] = indices;
    const row = list[rowIndex];
    if (!row || !isRow(row) || !row.columns) return list;

    if (rest.length === 0) {
      // Removing the whole row
      extracted = row;
      return [...list.slice(0, rowIndex), ...list.slice(rowIndex + 1)];
    }

    const cols = row.columns.map((col, ci) => {
      if (ci !== colIndex) return col;
      if (rest.length === 1) {
        const childIdx = rest[0];
        const child = col[childIdx];
        if (child) extracted = child;
        return [...col.slice(0, childIdx), ...col.slice(childIdx + 1)];
      }
      return removeFromList(col, rest);
    });

    const nextRow = syncRowMeta({ ...row, columns: cols });
    const unwrapped = unwrapIfNeeded(nextRow);
    return [
      ...list.slice(0, rowIndex),
      ...unwrapped,
      ...list.slice(rowIndex + 1),
    ];
  };

  const list = getList(section, path.list, path.sectionColumnIndex);
  const nextList = removeFromList(list, path.indices);
  if (!extracted) return null;

  return {
    section: setList(section, path.list, nextList, path.sectionColumnIndex),
    element: extracted,
  };
}

function insertAt(
  list: LandingElement[],
  index: number,
  element: LandingElement,
): LandingElement[] {
  const i = Math.max(0, Math.min(index, list.length));
  return [...list.slice(0, i), element, ...list.slice(i)];
}

/**
 * Place `element` relative to `targetId` inside the section.
 * Returns null if the operation is invalid.
 */
export function placeRelativeTo(
  section: LandingSection,
  targetId: string,
  element: LandingElement,
  position: DropPosition,
): LandingSection | null {
  if (targetId === element.id) return null;

  // Prevent dropping a row into itself / its descendants
  if (isRow(element)) {
    const path = findElementPath(section, targetId);
    if (path) {
      // After extract, target might still be inside dragged row if we didn't extract yet —
      // caller extracts first. Still guard nesting columns into columns.
      const target = findElementById(section, targetId);
      if (target && containsElement(element, targetId)) return null;
    }
  }

  const targetPath = findElementPath(section, targetId);
  if (!targetPath && position !== "end") return null;

  if (position === "end" || !targetPath) {
    return setList(
      section,
      "elements",
      [...(section.elements || []), element],
    );
  }

  const list = getList(section, targetPath.list, targetPath.sectionColumnIndex);

  // Target is nested inside a row
  if (targetPath.indices.length >= 3) {
    const [rowIndex, colIndex, childIndex] = targetPath.indices;
    const row = list[rowIndex];
    if (!row || !isRow(row) || !row.columns) return null;

    if (position === "before" || position === "after") {
      const col = [...(row.columns[colIndex] || [])];
      const insertIndex = position === "before" ? childIndex : childIndex + 1;
      col.splice(insertIndex, 0, element);
      const columns = row.columns.map((c, i) => (i === colIndex ? col : c));
      const nextRow = syncRowMeta({ ...row, columns });
      const nextList = [
        ...list.slice(0, rowIndex),
        ...unwrapIfNeeded(nextRow),
        ...list.slice(rowIndex + 1),
      ];
      return setList(
        section,
        targetPath.list,
        nextList,
        targetPath.sectionColumnIndex,
      );
    }

    // left/right within a row → new column beside this one
    if (position === "left" || position === "right") {
      const cols = [...(row.columns || [])];
      if (cols.length >= MAX_ROW_COLUMNS) {
        // Fall back: append into nearest column
        const targetCol = position === "left" ? colIndex : colIndex;
        cols[targetCol] = [...(cols[targetCol] || []), element];
      } else {
        const insertCol = position === "left" ? colIndex : colIndex + 1;
        cols.splice(insertCol, 0, [element]);
      }
      const nextRow = syncRowMeta({ ...row, columns: cols });
      const nextList = [
        ...list.slice(0, rowIndex),
        ...unwrapIfNeeded(nextRow),
        ...list.slice(rowIndex + 1),
      ];
      return setList(
        section,
        targetPath.list,
        nextList,
        targetPath.sectionColumnIndex,
      );
    }
  }

  // Target is a top-level item in the list (or a whole row)
  const topIndex = targetPath.indices[0];
  const target = list[topIndex];
  if (!target) return null;

  if (position === "before" || position === "after") {
    const insertIndex = position === "before" ? topIndex : topIndex + 1;
    return setList(
      section,
      targetPath.list,
      insertAt(list, insertIndex, element),
      targetPath.sectionColumnIndex,
    );
  }

  // left / right beside target
  if (isRow(target) && target.columns) {
    const cols = [...target.columns];
    if (cols.length >= MAX_ROW_COLUMNS) {
      const edge = position === "left" ? 0 : cols.length - 1;
      cols[edge] = [...(cols[edge] || []), element];
    } else if (position === "left") {
      cols.unshift([element]);
    } else {
      cols.push([element]);
    }
    const nextRow = syncRowMeta({ ...target, columns: cols });
    const nextList = [
      ...list.slice(0, topIndex),
      ...unwrapIfNeeded(nextRow),
      ...list.slice(topIndex + 1),
    ];
    return setList(
      section,
      targetPath.list,
      nextList,
      targetPath.sectionColumnIndex,
    );
  }

  // Wrap target + element into a new row
  const leftCol = position === "left" ? [element] : [target];
  const rightCol = position === "left" ? [target] : [element];
  const row = createRow([leftCol, rightCol]);
  const nextList = [
    ...list.slice(0, topIndex),
    row,
    ...list.slice(topIndex + 1),
  ];
  return setList(
    section,
    targetPath.list,
    nextList,
    targetPath.sectionColumnIndex,
  );
}

export function appendToSectionEnd(
  section: LandingSection,
  element: LandingElement,
  columnIndex?: number,
): LandingSection {
  if (typeof columnIndex === "number" && section.columns) {
    const columns = section.columns.map((col, i) =>
      i === columnIndex ? [...col, element] : col,
    );
    return { ...section, columns };
  }
  return { ...section, elements: [...(section.elements || []), element] };
}

export function findElementById(
  section: LandingSection,
  elementId: string,
): LandingElement | null {
  const walk = (list: LandingElement[]): LandingElement | null => {
    for (const el of list) {
      if (el.id === elementId) return el;
      for (const col of el.columns || []) {
        const found = walk(col);
        if (found) return found;
      }
    }
    return null;
  };
  return (
    walk(section.elements || []) ||
    (section.columns || []).reduce<LandingElement | null>(
      (found, col) => found || walk(col),
      null,
    )
  );
}

function containsElement(root: LandingElement, elementId: string): boolean {
  if (root.id === elementId) return true;
  for (const col of root.columns || []) {
    for (const child of col) {
      if (containsElement(child, elementId)) return true;
    }
  }
  return false;
}

export function isInvalidSelfDrop(
  movingId: string,
  targetId: string,
  movingElement: LandingElement,
): boolean {
  if (movingId === targetId) return true;
  return containsElement(movingElement, targetId);
}

/** Resolve drop edge from pointer position within an element box. */
export function resolveDropEdge(
  clientX: number,
  clientY: number,
  rect: DOMRect,
): DropPosition {
  const x = (clientX - rect.left) / Math.max(rect.width, 1);
  const y = (clientY - rect.top) / Math.max(rect.height, 1);

  // Prefer horizontal (same-row) when near left/right edges
  if (x < 0.22) return "left";
  if (x > 0.78) return "right";
  if (y < 0.45) return "before";
  return "after";
}
