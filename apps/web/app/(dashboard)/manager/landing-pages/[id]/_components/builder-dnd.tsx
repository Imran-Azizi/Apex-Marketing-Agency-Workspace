"use client";

import { useState, type DragEvent } from "react";
import { Copy, GripVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LandingElementView } from "@/components/landing/landing-elements";
import { cn } from "@/lib/utils";
import {
  createElement,
  duplicateElement,
  type LandingElement,
  type LandingElementType,
  type LandingSection,
} from "@/lib/landing-content";
import {
  appendToSectionEnd,
  extractElement,
  isInvalidSelfDrop,
  placeRelativeTo,
  resolveDropEdge,
  type DropPosition,
} from "@/lib/landing-layout";

export type BuilderDragPayload =
  | { kind: "palette-element"; type: LandingElementType }
  | { kind: "palette-section"; type: string }
  | { kind: "section"; id: string }
  | { kind: "element"; sectionId: string; elementId: string };

export type ActiveDropTarget = {
  elementId: string;
  position: DropPosition;
} | null;

export function parseBuilderDrag(e: DragEvent): BuilderDragPayload | null {
  try {
    const raw =
      e.dataTransfer.getData("application/json") ||
      e.dataTransfer.getData("text/plain");
    return raw ? (JSON.parse(raw) as BuilderDragPayload) : null;
  } catch {
    return null;
  }
}

export function setBuilderDrag(e: DragEvent, payload: BuilderDragPayload) {
  e.dataTransfer.effectAllowed = "copyMove";
  e.dataTransfer.setData("application/json", JSON.stringify(payload));
  e.dataTransfer.setData("text/plain", JSON.stringify(payload));
}

function DropIndicator({
  position,
  active,
}: {
  position: DropPosition;
  active: boolean;
}) {
  if (!active) return null;
  if (position === "before" || position === "after") {
    return (
      <div
        className={cn(
          "pointer-events-none absolute inset-x-2 z-20 h-0.5 rounded-full bg-brand",
          position === "before"
            ? "top-0 -translate-y-1/2"
            : "bottom-0 translate-y-1/2",
        )}
      />
    );
  }
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-y-2 z-20 w-0.5 rounded-full bg-brand",
        position === "left" ? "start-0 -translate-x-1/2" : "end-0 translate-x-1/2",
      )}
    />
  );
}

type CanvasHandlers = {
  sectionId: string;
  selectedId: string | null;
  canEdit: boolean;
  dropTarget: ActiveDropTarget;
  onSelect: (elementId: string) => void;
  onCommit: (next: LandingSection) => void;
  getSection: () => LandingSection;
  takeMoving: (
    payload: BuilderDragPayload,
  ) => { section: LandingSection; element: LandingElement } | null;
  onClearDrop: () => void;
  onSetDrop: (target: ActiveDropTarget) => void;
};

function CanvasElementItem({
  element,
  handlers,
}: {
  element: LandingElement;
  handlers: CanvasHandlers;
}) {
  const {
    sectionId,
    selectedId,
    canEdit,
    dropTarget,
    onSelect,
    onCommit,
    getSection,
    takeMoving,
    onClearDrop,
    onSetDrop,
  } = handlers;

  const isRow = element.type === "columns" || element.type === "grid";
  const active =
    dropTarget?.elementId === element.id ? dropTarget.position : null;
  const selected = selectedId === element.id;

  function applyDrop(targetId: string, position: DropPosition, e: DragEvent) {
    const payload = parseBuilderDrag(e);
    if (!payload || !canEdit) return;

    if (payload.kind === "palette-element") {
      const moving = createElement(payload.type);
      const next = placeRelativeTo(getSection(), targetId, moving, position);
      if (next) {
        onCommit(next);
        onSelect(moving.id);
      }
      onClearDrop();
      return;
    }

    if (payload.kind !== "element") return;
    if (payload.elementId === targetId) {
      onClearDrop();
      return;
    }

    const taken = takeMoving(payload);
    if (!taken) {
      onClearDrop();
      return;
    }

    if (isInvalidSelfDrop(payload.elementId, targetId, taken.element)) {
      onClearDrop();
      return;
    }

    const next = placeRelativeTo(
      taken.section,
      targetId,
      taken.element,
      position,
    );
    if (next) {
      onCommit(next);
      onSelect(taken.element.id);
    }
    onClearDrop();
  }

  return (
    <div
      className={cn(
        "group relative mb-2 w-full min-w-0 rounded-lg",
        selected && "ring-2 ring-brand",
        active && "bg-brand/[0.03]",
      )}
      draggable={canEdit && !element.locked}
      onDragStart={(e) => {
        e.stopPropagation();
        setBuilderDrag(e, {
          kind: "element",
          sectionId,
          elementId: element.id,
        });
      }}
      onDragEnd={onClearDrop}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(element.id);
      }}
      onDragOver={(e) => {
        if (!canEdit) return;
        e.preventDefault();
        e.stopPropagation();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        onSetDrop({
          elementId: element.id,
          position: resolveDropEdge(e.clientX, e.clientY, rect),
        });
      }}
      onDrop={(e) => {
        if (!canEdit) return;
        e.preventDefault();
        e.stopPropagation();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        applyDrop(
          element.id,
          resolveDropEdge(e.clientX, e.clientY, rect),
          e,
        );
      }}
    >
      <DropIndicator position="before" active={active === "before"} />
      <DropIndicator position="after" active={active === "after"} />
      <DropIndicator position="left" active={active === "left"} />
      <DropIndicator position="right" active={active === "right"} />

      {canEdit ? (
        <div className="absolute start-1 top-1 z-10 hidden gap-1 group-hover:flex">
          <span className="inline-flex h-6 w-6 cursor-grab items-center justify-center rounded-md bg-secondary text-muted-foreground">
            <GripVertical className="h-3 w-3" />
          </span>
          <Button
            size="icon"
            variant="secondary"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              const copy = duplicateElement(element);
              const next = placeRelativeTo(
                getSection(),
                element.id,
                copy,
                "after",
              );
              if (next) {
                onCommit(next);
                onSelect(copy.id);
              }
            }}
          >
            <Copy className="h-3 w-3" />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              const extracted = extractElement(getSection(), element.id);
              if (extracted) onCommit(extracted.section);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ) : null}

      {isRow && element.columns ? (
        <div
          className={cn(
            "grid w-full min-w-0 gap-3 rounded-lg border border-dashed border-border/60 bg-muted/20 p-2",
            element.columns.length <= 2 && "md:grid-cols-2",
            element.columns.length === 3 && "md:grid-cols-3",
            element.columns.length >= 4 && "grid-cols-2 lg:grid-cols-4",
          )}
        >
          {element.columns.map((col, colIndex) => (
            <div
              key={colIndex}
              className="min-h-[56px] min-w-0 rounded-md border border-dashed border-border/50 p-1"
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const last = col[col.length - 1];
                if (last) {
                  applyDrop(last.id, "after", e);
                } else {
                  applyDrop(
                    element.id,
                    colIndex === 0 ? "left" : "right",
                    e,
                  );
                }
              }}
            >
              {col.map((child) => (
                <CanvasElementItem
                  key={child.id}
                  element={child}
                  handlers={handlers}
                />
              ))}
              {col.length === 0 ? (
                <p className="py-4 text-center text-[10px] text-muted-foreground">
                  رها کنید
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="pointer-events-none w-full min-w-0 p-1">
          <LandingElementView element={element} />
        </div>
      )}
    </div>
  );
}

export function CanvasElementList({
  section,
  selectedElementId,
  canEdit,
  columnIndex,
  onSelectElement,
  onUpdateSection,
  takeMovingFromContent,
}: {
  section: LandingSection;
  selectedElementId: string | null;
  canEdit: boolean;
  columnIndex?: number;
  onSelectElement: (elementId: string) => void;
  onUpdateSection: (section: LandingSection) => void;
  /**
   * Extract a moving element. For same-section moves, extract from current
   * section snapshot. For cross-section, parent removes from source section
   * and returns the element with the already-updated target section base.
   */
  takeMovingFromContent: (
    payload: Extract<BuilderDragPayload, { kind: "element" }>,
    targetSection: LandingSection,
  ) => { section: LandingSection; element: LandingElement } | null;
}) {
  const [dropTarget, setDropTarget] = useState<ActiveDropTarget>(null);
  const [listOver, setListOver] = useState(false);

  const elements =
    typeof columnIndex === "number" && section.columns
      ? section.columns[columnIndex] || []
      : section.elements || [];

  const handlers: CanvasHandlers = {
    sectionId: section.id,
    selectedId: selectedElementId,
    canEdit,
    dropTarget,
    onSelect: onSelectElement,
    onCommit: onUpdateSection,
    getSection: () => section,
    takeMoving: (payload) => {
      if (payload.kind !== "element") return null;
      return takeMovingFromContent(payload, section);
    },
    onClearDrop: () => setDropTarget(null),
    onSetDrop: setDropTarget,
  };

  function dropAtEnd(e: DragEvent) {
    const payload = parseBuilderDrag(e);
    if (!payload || !canEdit) return;

    if (payload.kind === "palette-element") {
      const el = createElement(payload.type);
      onUpdateSection(appendToSectionEnd(section, el, columnIndex));
      onSelectElement(el.id);
      setDropTarget(null);
      setListOver(false);
      return;
    }

    if (payload.kind === "element") {
      const taken = takeMovingFromContent(payload, section);
      if (!taken) return;
      onUpdateSection(
        appendToSectionEnd(taken.section, taken.element, columnIndex),
      );
      onSelectElement(taken.element.id);
    }
    setDropTarget(null);
    setListOver(false);
  }

  return (
    <div
      className={cn(
        "min-h-[80px] w-full min-w-0 rounded-xl border border-dashed p-2 transition-colors",
        listOver ? "border-brand bg-brand/5" : "border-border/70",
      )}
      onDragOver={(e) => {
        if (!canEdit) return;
        e.preventDefault();
        e.stopPropagation();
        setListOver(true);
      }}
      onDragLeave={() => setListOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        dropAtEnd(e);
      }}
    >
      {elements.map((el) => (
        <CanvasElementItem key={el.id} element={el} handlers={handlers} />
      ))}
      {elements.length === 0 ? (
        <p className="py-6 text-center text-[10px] text-muted-foreground">
          عنصر را اینجا رها کنید
        </p>
      ) : (
        <p
          className={cn(
            "py-3 text-center text-[10px] text-muted-foreground",
            listOver && "text-brand",
          )}
        >
          برای افزودن در انتها اینجا رها کنید
        </p>
      )}
    </div>
  );
}
