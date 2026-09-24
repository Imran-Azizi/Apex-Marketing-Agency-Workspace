"use client";

import { useState, type DragEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import {
  Columns3,
  Copy,
  Eye,
  GripVertical,
  Monitor,
  PanelRight,
  Save,
  Smartphone,
  Tablet,
  Trash2,
  Type,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { apiPatch, apiPost, ensureCsrf } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LandingHeroView } from "@/components/landing/landing-hero";
import { LandingSectionView } from "@/components/landing/landing-section";
import { LandingElementView } from "@/components/landing/landing-elements";
import { BuilderSettingsPanel } from "./builder-settings";
import { cn } from "@/lib/utils";
import {
  ELEMENT_PALETTE,
  SECTION_PALETTE,
  createElement,
  createSection,
  duplicateElement,
  duplicateSection,
  type LandingContent,
  type LandingElement,
  type LandingElementType,
  type LandingHero,
  type LandingSection,
  type LandingSectionType,
} from "@/lib/landing-content";
import type { LandingPage } from "@/lib/landing-pages";

type Selection =
  | { kind: "hero" }
  | { kind: "section"; id: string }
  | { kind: "element"; sectionId: string; elementId: string };

type Device = "desktop" | "tablet" | "mobile";

type DragPayload =
  | { kind: "palette-element"; type: LandingElementType }
  | { kind: "palette-section"; type: LandingSectionType }
  | { kind: "section"; id: string }
  | { kind: "element"; sectionId: string; elementId: string };

function parseDrag(e: DragEvent): DragPayload | null {
  try {
    const raw = e.dataTransfer.getData("application/json") || e.dataTransfer.getData("text/plain");
    return raw ? (JSON.parse(raw) as DragPayload) : null;
  } catch {
    return null;
  }
}

function setDrag(e: DragEvent, payload: DragPayload) {
  e.dataTransfer.effectAllowed = "copyMove";
  e.dataTransfer.setData("application/json", JSON.stringify(payload));
  e.dataTransfer.setData("text/plain", JSON.stringify(payload));
}

function mapElements(
  list: LandingElement[] = [],
  elementId: string,
  updater: (el: LandingElement) => LandingElement | null,
): LandingElement[] {
  const next: LandingElement[] = [];
  for (const el of list) {
    if (el.id === elementId) {
      const updated = updater(el);
      if (updated) next.push(updated);
      continue;
    }
    next.push({
      ...el,
      columns: el.columns
        ? el.columns.map((col) => mapElements(col, elementId, updater))
        : el.columns,
    });
  }
  return next;
}

function updateSectionElement(
  section: LandingSection,
  elementId: string,
  updater: (el: LandingElement) => LandingElement | null,
): LandingSection {
  return {
    ...section,
    elements: mapElements(section.elements, elementId, updater),
    columns: section.columns
      ? section.columns.map((col) => mapElements(col, elementId, updater))
      : section.columns,
  };
}

function appendToTarget(
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

function removeElement(section: LandingSection, elementId: string): LandingSection {
  return updateSectionElement(section, elementId, () => null);
}

export function LandingBuilder({
  initial,
  canEdit,
  canPublish,
}: {
  initial: LandingPage;
  canEdit: boolean;
  canPublish: boolean;
}) {
  const router = useRouter();
  const [page, setPage] = useState(initial);
  const [content, setContent] = useState<LandingContent>(initial.content);
  const [selection, setSelection] = useState<Selection>({ kind: "hero" });
  const [device, setDevice] = useState<Device>("desktop");
  const [dirty, setDirty] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"palette" | "canvas" | "settings">("canvas");

  function mark(nextContent?: LandingContent, nextPage?: LandingPage) {
    if (nextContent) setContent(nextContent);
    if (nextPage) setPage(nextPage);
    setDirty(true);
  }

  function updateHero(hero: LandingHero) {
    mark({ ...content, hero });
  }

  function updateSection(next: LandingSection) {
    mark({
      ...content,
      sections: content.sections.map((s) => (s.id === next.id ? next : s)),
    });
  }

  function updateElement(sectionId: string, next: LandingElement) {
    mark({
      ...content,
      sections: content.sections.map((section) =>
        section.id === sectionId
          ? updateSectionElement(section, next.id, () => next)
          : section,
      ),
    });
  }

  function addSection(type: LandingSectionType, beforeId?: string) {
    const section = createSection(type);
    const sections = [...content.sections];
    const index = beforeId ? sections.findIndex((s) => s.id === beforeId) : -1;
    if (index >= 0) sections.splice(index, 0, section);
    else sections.push(section);
    mark({ ...content, sections });
    setSelection({ kind: "section", id: section.id });
  }

  function addElement(sectionId: string, type: LandingElementType, columnIndex?: number) {
    const element = createElement(type);
    mark({
      ...content,
      sections: content.sections.map((section) =>
        section.id === sectionId ? appendToTarget(section, element, columnIndex) : section,
      ),
    });
    setSelection({ kind: "element", sectionId, elementId: element.id });
  }

  function dropOnSection(sectionId: string, payload: DragPayload | null, columnIndex?: number) {
    if (!payload || !canEdit) return;
    if (payload.kind === "palette-element") {
      addElement(sectionId, payload.type, columnIndex);
      return;
    }
    if (payload.kind === "element") {
      const from = content.sections.find((s) => s.id === payload.sectionId);
      if (!from) return;
      let moving: LandingElement | null = null;
      const stripped = updateSectionElement(from, payload.elementId, (el) => {
        moving = el;
        return null;
      });
      if (!moving) return;
      mark({
        ...content,
        sections: content.sections.map((section) => {
          if (section.id === payload.sectionId && section.id !== sectionId) return stripped;
          if (section.id === sectionId) {
            const base = section.id === payload.sectionId ? stripped : section;
            return appendToTarget(base, moving as LandingElement, columnIndex);
          }
          return section;
        }),
      });
    }
  }

  function dropOnCanvas(payload: DragPayload | null, beforeSectionId?: string) {
    if (!payload || !canEdit) return;
    if (payload.kind === "palette-section") {
      addSection(payload.type, beforeSectionId);
      return;
    }
    if (payload.kind === "section" && beforeSectionId && payload.id !== beforeSectionId) {
      const current = [...content.sections];
      const from = current.findIndex((s) => s.id === payload.id);
      const to = current.findIndex((s) => s.id === beforeSectionId);
      if (from < 0 || to < 0) return;
      const [item] = current.splice(from, 1);
      current.splice(to, 0, item);
      mark({ ...content, sections: current });
    }
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      await ensureCsrf();
      return apiPatch<LandingPage>(`/landing-pages/${page.id}`, {
        content,
      });
    },
    onSuccess: (saved) => {
      setPage(saved);
      setContent(saved.content);
      setDirty(false);
      toast.success("پیش‌نویس ذخیره شد");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "ذخیره ناموفق بود"),
  });

  const publishMut = useMutation({
    mutationFn: async () => {
      await ensureCsrf();
      await apiPatch(`/landing-pages/${page.id}`, {
        content,
      });
      return apiPost<LandingPage>(`/landing-pages/${page.id}/publish`);
    },
    onSuccess: (saved) => {
      setPage(saved);
      setContent(saved.content);
      setDirty(false);
      toast.success("صفحه منتشر شد");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "انتشار ناموفق بود"),
  });

  const unpublishMut = useMutation({
    mutationFn: async () => {
      await ensureCsrf();
      return apiPost<LandingPage>(`/landing-pages/${page.id}/unpublish`);
    },
    onSuccess: (saved) => {
      setPage(saved);
      toast.success("صفحه از حالت انتشار خارج شد");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "لغو انتشار ناموفق بود"),
  });

  const frameClass =
    device === "mobile"
      ? "max-w-[390px]"
      : device === "tablet"
        ? "max-w-[768px]"
        : "max-w-5xl";

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden bg-background"
      dir="rtl"
    >
      <header className="flex h-12 shrink-0 items-center gap-2 overflow-x-auto border-b border-border/70 bg-card px-3 sm:gap-3 sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="h-8 shrink-0 px-2 text-muted-foreground hover:text-foreground"
          >
            <Link href="/manager/landing-pages">بازگشت</Link>
          </Button>
          <div
            className="hidden h-4 w-px shrink-0 self-center bg-border/70 sm:block"
            aria-hidden
          />
          <p className="min-w-0 truncate text-sm font-semibold leading-none">
            {page.title}
          </p>
          <Badge
            variant={page.isPublished ? "success" : "secondary"}
            className="h-6 shrink-0 items-center whitespace-nowrap px-2.5 py-0 text-[11px] leading-none"
          >
            {page.isPublished ? "منتشرشده" : "پیش‌نویس"}
          </Badge>
          <p
            className="min-w-0 truncate text-[11px] leading-none text-muted-foreground"
            dir="ltr"
          >
            /{page.slug}
          </p>
          {page.hasUnpublishedChanges || dirty ? (
            <Badge
              variant="warning"
              className="hidden h-6 shrink-0 items-center whitespace-nowrap px-2.5 py-0 text-[11px] leading-none md:inline-flex"
            >
              تغییرات ذخیره‌نشده
            </Badge>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <div className="flex items-center rounded-lg border border-border/70 p-0.5">
            <Button
              size="icon"
              variant={device === "desktop" ? "secondary" : "ghost"}
              className="h-8 w-8"
              title="دسکتاپ"
              aria-label="پیش‌نمایش دسکتاپ"
              onClick={() => setDevice("desktop")}
            >
              <Monitor className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant={device === "tablet" ? "secondary" : "ghost"}
              className="h-8 w-8"
              title="تبلت"
              aria-label="پیش‌نمایش تبلت"
              onClick={() => setDevice("tablet")}
            >
              <Tablet className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant={device === "mobile" ? "secondary" : "ghost"}
              className="h-8 w-8"
              title="موبایل"
              aria-label="پیش‌نمایش موبایل"
              onClick={() => setDevice("mobile")}
            >
              <Smartphone className="h-4 w-4" />
            </Button>
          </div>

          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 px-2.5"
            onClick={() =>
              router.push(`/manager/landing-pages/${page.id}/preview`)
            }
          >
            <Eye className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden lg:inline">پیش‌نمایش</span>
          </Button>
          {canEdit ? (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 px-2.5"
              disabled={saveMut.isPending}
              onClick={() => saveMut.mutate()}
            >
              <Save className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden lg:inline">ذخیره</span>
            </Button>
          ) : null}
          {canPublish && page.isPublished ? (
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2.5"
              disabled={unpublishMut.isPending}
              onClick={() => unpublishMut.mutate()}
            >
              <span className="lg:hidden">لغو</span>
              <span className="hidden lg:inline">لغو انتشار</span>
            </Button>
          ) : null}
          {canPublish ? (
            <Button
              size="sm"
              variant="brand"
              className="h-8 gap-1.5 px-2.5"
              disabled={publishMut.isPending}
              onClick={() => publishMut.mutate()}
            >
              <UploadCloud className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">انتشار</span>
            </Button>
          ) : null}
        </div>
      </header>

      <div className="flex shrink-0 gap-2 border-b border-border/70 px-3 py-2 lg:hidden">
        {(["palette", "canvas", "settings"] as const).map((id) => (
          <Button
            key={id}
            size="sm"
            variant={mobilePanel === id ? "secondary" : "ghost"}
            className="h-8 flex-1"
            onClick={() => setMobilePanel(id)}
          >
            {id === "palette" ? "اجزاء" : id === "canvas" ? "بوم" : "تنظیمات"}
          </Button>
        ))}
      </div>

      <div className="grid min-h-0 min-w-0 flex-1 overflow-hidden lg:grid-cols-[220px_minmax(0,1fr)_280px]">
        <aside
          className={cn(
            "flex min-h-0 min-w-0 flex-col overflow-hidden border-e border-border/70 bg-card",
            mobilePanel !== "palette" && "hidden lg:flex",
          )}
        >
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">بخش‌ها</p>
          <div className="space-y-1.5">
            {SECTION_PALETTE.map((item) => (
              <button
                key={item.type}
                type="button"
                draggable={canEdit}
                onDragStart={(e) => setDrag(e, { kind: "palette-section", type: item.type })}
                onClick={() => canEdit && addSection(item.type)}
                className="flex w-full items-center gap-2 rounded-lg border border-border/60 px-2.5 py-2 text-start text-xs hover:border-brand/40 hover:bg-brand/5"
              >
                <Columns3 className="h-3.5 w-3.5 text-muted-foreground" />
                {item.label}
              </button>
            ))}
          </div>
          <p className="mb-2 mt-4 text-xs font-semibold text-muted-foreground">عناصر</p>
          <div className="grid grid-cols-2 gap-1.5">
            {ELEMENT_PALETTE.map((item) => (
              <button
                key={item.type}
                type="button"
                draggable={canEdit}
                onDragStart={(e) => setDrag(e, { kind: "palette-element", type: item.type })}
                onClick={() => {
                  if (!canEdit) return;
                  const sectionId =
                    selection.kind === "section"
                      ? selection.id
                      : selection.kind === "element"
                        ? selection.sectionId
                        : content.sections[content.sections.length - 1]?.id;
                  if (sectionId) {
                    addElement(sectionId, item.type);
                    return;
                  }
                  const section = createSection("content");
                  const element = createElement(item.type);
                  section.elements = [element];
                  mark({ ...content, sections: [...content.sections, section] });
                  setSelection({
                    kind: "element",
                    sectionId: section.id,
                    elementId: element.id,
                  });
                }}
                className="rounded-lg border border-border/60 px-2 py-2 text-[11px] hover:border-brand/40 hover:bg-brand/5"
              >
                <Type className="mb-1 h-3.5 w-3.5 text-muted-foreground" />
                {item.label}
              </button>
            ))}
          </div>
          </div>
        </aside>

        <div
          className={cn(
            "min-h-0 min-w-0 overflow-y-auto overscroll-contain bg-muted/30 p-3 sm:p-4 [direction:ltr]",
            mobilePanel !== "canvas" && "hidden lg:block",
          )}
        >
          <div
            dir="rtl"
            className={cn(
              "mx-auto overflow-hidden rounded-2xl border border-border/70 bg-background shadow-sm",
              frameClass,
            )}
          >
            <div
              onClick={() => setSelection({ kind: "hero" })}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                dropOnCanvas(parseDrag(e), content.sections[0]?.id);
              }}
            >
              <LandingHeroView
                hero={content.hero}
                selected={selection.kind === "hero"}
                onSelect={() => setSelection({ kind: "hero" })}
              />
            </div>

            {content.sections.map((section) => (
              <div
                key={section.id}
                draggable={canEdit}
                onDragStart={(e) => setDrag(e, { kind: "section", id: section.id })}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const payload = parseDrag(e);
                  if (payload?.kind === "palette-section" || payload?.kind === "section") {
                    dropOnCanvas(payload, section.id);
                  } else {
                    dropOnSection(section.id, payload);
                  }
                }}
              >
                <LandingSectionView
                  section={section}
                  selected={selection.kind === "section" && selection.id === section.id}
                  onSelect={() => setSelection({ kind: "section", id: section.id })}
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <GripVertical className="h-3.5 w-3.5" />
                      {SECTION_PALETTE.find((s) => s.type === section.type)?.label || "بخش"}
                    </span>
                    {canEdit ? (
                      <span className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            const copy = duplicateSection(section);
                            mark({
                              ...content,
                              sections: content.sections.flatMap((s) =>
                                s.id === section.id ? [s, copy] : [s],
                              ),
                            });
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            mark({
                              ...content,
                              sections: content.sections.filter((s) => s.id !== section.id),
                            });
                            setSelection({ kind: "hero" });
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </span>
                    ) : null}
                  </div>
                  {section.columns ? (
                    <div className={cn("grid gap-4 md:grid-cols-2", section.columns.length >= 3 && "lg:grid-cols-3")}>
                      {section.columns.map((col, colIndex) => (
                        <div
                          key={colIndex}
                          className="min-h-[80px] min-w-0 rounded-xl border border-dashed border-border/70 p-2"
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            dropOnSection(section.id, parseDrag(e), colIndex);
                          }}
                        >
                          {col.map((el) => (
                            <EditableElement
                              key={el.id}
                              element={el}
                              selected={selection.kind === "element" && selection.elementId === el.id}
                              onSelect={() =>
                                setSelection({
                                  kind: "element",
                                  sectionId: section.id,
                                  elementId: el.id,
                                })
                              }
                              onDragStart={(e) =>
                                setDrag(e, {
                                  kind: "element",
                                  sectionId: section.id,
                                  elementId: el.id,
                                })
                              }
                              onDuplicate={() => {
                                const copy = duplicateElement(el);
                                const columns = section.columns!.map((c, i) =>
                                  i === colIndex
                                    ? c.flatMap((item) => (item.id === el.id ? [item, copy] : [item]))
                                    : c,
                                );
                                updateSection({ ...section, columns });
                              }}
                              onDelete={() => updateSection(removeElement(section, el.id))}
                            />
                          ))}
                          <p className="py-3 text-center text-[10px] text-muted-foreground">
                            عنصر را اینجا رها کنید
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="min-h-[80px] rounded-xl border border-dashed border-border/70 p-2">
                      {(section.elements || []).map((el) => (
                        <EditableElement
                          key={el.id}
                          element={el}
                          selected={selection.kind === "element" && selection.elementId === el.id}
                          onSelect={() =>
                            setSelection({
                              kind: "element",
                              sectionId: section.id,
                              elementId: el.id,
                            })
                          }
                          onDragStart={(e) =>
                            setDrag(e, {
                              kind: "element",
                              sectionId: section.id,
                              elementId: el.id,
                            })
                          }
                          onDuplicate={() => {
                            const copy = duplicateElement(el);
                            updateSection({
                              ...section,
                              elements: section.elements.flatMap((item) =>
                                item.id === el.id ? [item, copy] : [item],
                              ),
                            });
                          }}
                          onDelete={() => updateSection(removeElement(section, el.id))}
                        />
                      ))}
                      <p className="py-3 text-center text-[10px] text-muted-foreground">
                        عنصر را اینجا رها کنید
                      </p>
                    </div>
                  )}
                </LandingSectionView>
              </div>
            ))}

            <div
              className="border-t border-dashed px-4 py-8 text-center text-xs text-muted-foreground"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                dropOnCanvas(parseDrag(e));
              }}
            >
              بخش جدید را اینجا رها کنید
            </div>
          </div>
        </div>

        <aside
          className={cn(
            "flex min-h-0 min-w-0 flex-col overflow-hidden border-s border-border/70 bg-card",
            mobilePanel !== "settings" && "hidden lg:flex",
          )}
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-3 py-2.5 text-sm font-semibold">
            <PanelRight className="h-4 w-4" />
            تنظیمات
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
            <BuilderSettingsPanel
              content={content}
              selection={selection}
              onHero={updateHero}
              onSection={updateSection}
              onElement={updateElement}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

function EditableElement({
  element,
  selected,
  onSelect,
  onDragStart,
  onDuplicate,
  onDelete,
}: {
  element: LandingElement;
  selected: boolean;
  onSelect: () => void;
  onDragStart: (e: DragEvent) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      className={cn(
        "group relative mb-2 cursor-grab rounded-lg p-1",
        selected && "ring-2 ring-brand",
      )}
    >
      <div className="pointer-events-none">
        <LandingElementView element={element} />
      </div>
      <div className="absolute start-1 top-1 hidden gap-1 group-hover:flex">
        <Button size="icon" variant="secondary" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onDuplicate(); }}>
          <Copy className="h-3 w-3" />
        </Button>
        <Button size="icon" variant="secondary" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
