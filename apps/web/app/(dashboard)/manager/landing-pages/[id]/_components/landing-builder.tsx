"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import {
  Columns3,
  Copy,
  Eye,
  GripVertical,
  PanelRight,
  Redo2,
  Save,
  Trash2,
  Undo2,
  UploadCloud,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { apiPatch, apiPost, ensureCsrf } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LandingHeroView } from "@/components/landing/landing-hero";
import { LandingSectionView } from "@/components/landing/landing-section";
import { BuilderSettingsPanel } from "./builder-settings";
import { BuilderAiPanel } from "./builder-ai-panel";
import {
  LandingDevicePreviewFrame,
  LandingDevicePreviewProvider,
  LandingDevicePreviewToolbar,
} from "@/components/landing/landing-device-preview";
import {
  CanvasElementList,
  parseBuilderDrag,
  setBuilderDrag,
  type BuilderDragPayload,
} from "./builder-dnd";
import { cn } from "@/lib/utils";
import {
  ELEMENT_PALETTE_GROUPS,
  SECTION_PALETTE,
  cloneBlock,
  createElement,
  createSection,
  duplicateElement,
  duplicateSection,
  findElementInSection,
  type LandingContent,
  type LandingElement,
  type LandingElementType,
  type LandingHero,
  type LandingSection,
  type LandingSectionType,
} from "@/lib/landing-content";
import {
  appendToSectionEnd,
  extractElement,
} from "@/lib/landing-layout";
import {
  buildSectionFromTemplate,
  SECTION_TEMPLATES,
  type SectionTemplateId,
} from "@/lib/landing-templates";
import { useLandingHistory } from "@/lib/use-landing-history";
import type { LandingPage } from "@/lib/landing-pages";

type Selection =
  | { kind: "hero" }
  | { kind: "section"; id: string }
  | { kind: "element"; sectionId: string; elementId: string };

type DragPayload = BuilderDragPayload;

function parseDrag(e: DragEvent): DragPayload | null {
  return parseBuilderDrag(e);
}

function setDrag(e: DragEvent, payload: DragPayload) {
  setBuilderDrag(e, payload);
}

function updateSectionElement(
  section: LandingSection,
  elementId: string,
  updater: (el: LandingElement) => LandingElement | null,
): LandingSection {
  const mapElements = (
    list: LandingElement[] = [],
  ): LandingElement[] => {
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
          ? el.columns.map((col) => mapElements(col))
          : el.columns,
      });
    }
    return next;
  };
  return {
    ...section,
    elements: mapElements(section.elements),
    columns: section.columns
      ? section.columns.map((col) => mapElements(col))
      : section.columns,
  };
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
  const {
    content,
    setContent: setHistoryContent,
    undo,
    redo,
    canUndo,
    canRedo,
    reset: resetHistory,
  } = useLandingHistory(initial.content);
  const [selection, setSelection] = useState<Selection>({ kind: "hero" });
  const [dirty, setDirty] = useState(false);
  const [leftTab, setLeftTab] = useState<"ai" | "elements" | "templates">(
    "elements",
  );
  const [mobilePanel, setMobilePanel] = useState<
    "palette" | "canvas" | "settings"
  >("canvas");
  const clipboardRef = useRef<LandingElement | LandingSection | null>(null);
  const pendingSourceSectionRef = useRef<LandingSection | null>(null);

  function mark(nextContent?: LandingContent, nextPage?: LandingPage) {
    if (nextContent) setHistoryContent(nextContent);
    if (nextPage) setPage(nextPage);
    setDirty(true);
  }

  const copySelection = useCallback(() => {
    if (selection.kind === "section") {
      const section = content.sections.find((s) => s.id === selection.id);
      if (section) clipboardRef.current = cloneBlock(section);
    }
    if (selection.kind === "element") {
      const section = content.sections.find((s) => s.id === selection.sectionId);
      const el = findElementInSection(section, selection.elementId);
      if (el) clipboardRef.current = cloneBlock(el);
    }
  }, [content.sections, selection]);

  const pasteClipboard = useCallback(() => {
    const clip = clipboardRef.current;
    if (!clip || !canEdit) return;
    if ("settings" in clip) {
      const copy = duplicateSection(clip as LandingSection);
      mark({ ...content, sections: [...content.sections, copy] });
      setSelection({ kind: "section", id: copy.id });
      return;
    }
    const sectionId =
      selection.kind === "section"
        ? selection.id
        : selection.kind === "element"
          ? selection.sectionId
          : content.sections[content.sections.length - 1]?.id;
    if (!sectionId) return;
    const copy = duplicateElement(clip as LandingElement);
    mark({
      ...content,
      sections: content.sections.map((section) =>
        section.id === sectionId
          ? appendToSectionEnd(section, copy)
          : section,
      ),
    });
    setSelection({ kind: "element", sectionId, elementId: copy.id });
  }, [canEdit, content, selection]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        setDirty(true);
      }
      if (e.key === "y" || (e.key === "z" && e.shiftKey)) {
        e.preventDefault();
        redo();
        setDirty(true);
      }
      if (e.key === "c") copySelection();
      if (e.key === "v") {
        e.preventDefault();
        pasteClipboard();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [copySelection, pasteClipboard, redo, undo]);

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

  function addElement(
    sectionId: string,
    type: LandingElementType,
    columnIndex?: number,
  ) {
    const element = createElement(type);
    mark({
      ...content,
      sections: content.sections.map((section) =>
        section.id === sectionId
          ? appendToSectionEnd(section, element, columnIndex)
          : section,
      ),
    });
    setSelection({ kind: "element", sectionId, elementId: element.id });
  }

  function commitSectionUpdate(next: LandingSection) {
    const pendingSource = pendingSourceSectionRef.current;
    pendingSourceSectionRef.current = null;
    mark({
      ...content,
      sections: content.sections.map((section) => {
        if (pendingSource && section.id === pendingSource.id) {
          return pendingSource.id === next.id ? next : pendingSource;
        }
        if (section.id === next.id) return next;
        return section;
      }),
    });
  }

  function takeMovingFromContent(
    payload: Extract<BuilderDragPayload, { kind: "element" }>,
    targetSection: LandingSection,
  ): { section: LandingSection; element: LandingElement } | null {
    if (payload.sectionId === targetSection.id) {
      return extractElement(targetSection, payload.elementId);
    }
    const source = content.sections.find((s) => s.id === payload.sectionId);
    if (!source) return null;
    const extracted = extractElement(source, payload.elementId);
    if (!extracted) return null;
    pendingSourceSectionRef.current = extracted.section;
    return { section: targetSection, element: extracted.element };
  }

  function dropOnSection(
    sectionId: string,
    payload: DragPayload | null,
    columnIndex?: number,
  ) {
    if (!payload || !canEdit) return;
    if (payload.kind === "palette-element") {
      addElement(sectionId, payload.type, columnIndex);
      return;
    }
    if (payload.kind === "element") {
      const target = content.sections.find((s) => s.id === sectionId);
      if (!target) return;
      const taken = takeMovingFromContent(payload, target);
      if (!taken) return;
      commitSectionUpdate(
        appendToSectionEnd(taken.section, taken.element, columnIndex),
      );
      setSelection({
        kind: "element",
        sectionId,
        elementId: taken.element.id,
      });
    }
  }

  function dropOnCanvas(payload: DragPayload | null, beforeSectionId?: string) {
    if (!payload || !canEdit) return;
    if (payload.kind === "palette-section") {
      addSection(payload.type as LandingSectionType, beforeSectionId);
      return;
    }
    if (
      payload.kind === "section" &&
      beforeSectionId &&
      payload.id !== beforeSectionId
    ) {
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
      resetHistory(saved.content);
      setDirty(false);
      toast.success("پیش‌نویس ذخیره شد");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "ذخیره ناموفق بود"),
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
      resetHistory(saved.content);
      setDirty(false);
      toast.success("صفحه منتشر شد");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "انتشار ناموفق بود"),
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
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "لغو انتشار ناموفق بود"),
  });

  return (
    <LandingDevicePreviewProvider defaultDevice="desktop">
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

        <div className="hidden shrink-0 md:block">
          <LandingDevicePreviewToolbar />
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {canEdit ? (
            <div className="hidden items-center gap-0.5 sm:flex">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                disabled={!canUndo}
                onClick={() => {
                  undo();
                  setDirty(true);
                }}
                title="Undo (Ctrl+Z)"
              >
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                disabled={!canRedo}
                onClick={() => {
                  redo();
                  setDirty(true);
                }}
                title="Redo (Ctrl+Y)"
              >
                <Redo2 className="h-4 w-4" />
              </Button>
            </div>
          ) : null}

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

      <div className="grid min-h-0 min-w-0 flex-1 overflow-hidden lg:grid-cols-[240px_minmax(0,1fr)_300px]">
        <aside
          className={cn(
            "flex min-h-0 min-w-0 flex-col overflow-hidden border-e border-border/70 bg-card",
            mobilePanel !== "palette" && "hidden lg:flex",
          )}
        >
          <div className="flex shrink-0 gap-1 border-b border-border/60 p-2">
            {(
              [
                ["ai", "هوش مصنوعی"],
                ["elements", "اجزاء"],
                ["templates", "قالب"],
              ] as const
            ).map(([id, label]) => (
              <Button
                key={id}
                size="sm"
                variant={leftTab === id ? "secondary" : "ghost"}
                className="h-8 min-w-0 flex-1 gap-1 px-1 text-[10px] font-medium"
                onClick={() => setLeftTab(id)}
              >
                {id === "ai" ? (
                  <Sparkles className="h-3 w-3 shrink-0 text-brand" />
                ) : null}
                <span className="truncate">{label}</span>
              </Button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
            {leftTab === "ai" ? (
              <BuilderAiPanel
                canEdit={canEdit}
                pageTitle={page.title}
                content={content}
                selection={selection}
                onApply={(next, meta) => {
                  mark(next);
                  if (!meta?.keepSelection) {
                    setSelection({ kind: "hero" });
                  }
                }}
              />
            ) : null}

            {leftTab === "elements" ? (
              <>
                <p className="mb-2 text-xs font-semibold text-muted-foreground">
                  بخش‌ها
                </p>
                <div className="space-y-1.5">
                  {SECTION_PALETTE.map((item) => (
                    <button
                      key={item.type}
                      type="button"
                      draggable={canEdit}
                      onDragStart={(e) =>
                        setDrag(e, {
                          kind: "palette-section",
                          type: item.type,
                        })
                      }
                      onClick={() => canEdit && addSection(item.type)}
                      className="flex w-full items-center gap-2 rounded-lg border border-border/60 px-2.5 py-2 text-start text-xs hover:border-brand/40 hover:bg-brand/5"
                    >
                      <Columns3 className="h-3.5 w-3.5 text-muted-foreground" />
                      {item.label}
                    </button>
                  ))}
                </div>
                {ELEMENT_PALETTE_GROUPS.map((group) => (
                  <div key={group.label} className="mt-4">
                    <p className="mb-2 text-xs font-semibold text-muted-foreground">
                      {group.label}
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {group.items.map((item) => (
                        <button
                          key={item.type}
                          type="button"
                          draggable={canEdit}
                          onDragStart={(e) =>
                            setDrag(e, {
                              kind: "palette-element",
                              type: item.type,
                            })
                          }
                          onClick={() => {
                            if (!canEdit) return;
                            const sectionId =
                              selection.kind === "section"
                                ? selection.id
                                : selection.kind === "element"
                                  ? selection.sectionId
                                  : content.sections[
                                      content.sections.length - 1
                                    ]?.id;
                            if (sectionId) {
                              addElement(sectionId, item.type);
                              return;
                            }
                            const section = createSection("content");
                            const element = createElement(item.type);
                            section.elements = [element];
                            mark({
                              ...content,
                              sections: [...content.sections, section],
                            });
                            setSelection({
                              kind: "element",
                              sectionId: section.id,
                              elementId: element.id,
                            });
                          }}
                          className="rounded-lg border border-border/60 px-2 py-2 text-[10px] hover:border-brand/40 hover:bg-brand/5"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            ) : null}

            {leftTab === "templates" ? (
              <div className="space-y-2">
                {SECTION_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => {
                      const section = buildSectionFromTemplate(
                        template.id as SectionTemplateId,
                      );
                      mark({
                        ...content,
                        sections: [...content.sections, section],
                      });
                      setSelection({ kind: "section", id: section.id });
                      toast.success(`قالب «${template.label}» اضافه شد`);
                    }}
                    className="w-full rounded-lg border border-border/60 px-3 py-2.5 text-start hover:border-brand/40 hover:bg-brand/5 disabled:opacity-50"
                  >
                    <p className="text-xs font-medium">{template.label}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {template.description}
                    </p>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </aside>

        <BuilderDeviceCanvas
          className={cn(mobilePanel !== "canvas" && "hidden lg:block")}
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

            {content.sections.map((section) =>
              section.hidden ? null : (
              <div
                key={section.id}
                draggable={canEdit && !section.locked}
                onDragStart={(e) =>
                  setDrag(e, { kind: "section", id: section.id })
                }
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const payload = parseDrag(e);
                  if (
                    payload?.kind === "palette-section" ||
                    payload?.kind === "section"
                  ) {
                    dropOnCanvas(payload, section.id);
                  } else {
                    dropOnSection(section.id, payload);
                  }
                }}
              >
                <LandingSectionView
                  section={section}
                  selected={
                    selection.kind === "section" && selection.id === section.id
                  }
                  onSelect={() =>
                    setSelection({ kind: "section", id: section.id })
                  }
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <GripVertical className="h-3.5 w-3.5" />
                      {SECTION_PALETTE.find((s) => s.type === section.type)
                        ?.label || "بخش"}
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
                              sections: content.sections.filter(
                                (s) => s.id !== section.id,
                              ),
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
                    <div
                      className={cn(
                        "grid w-full min-w-0 gap-4",
                        section.columns.length >= 3
                          ? "md:grid-cols-3"
                          : "md:grid-cols-2",
                      )}
                    >
                      {section.columns.map((_, colIndex) => (
                        <CanvasElementList
                          key={colIndex}
                          section={section}
                          columnIndex={colIndex}
                          selectedElementId={
                            selection.kind === "element" &&
                            selection.sectionId === section.id
                              ? selection.elementId
                              : null
                          }
                          canEdit={canEdit}
                          onSelectElement={(elementId) =>
                            setSelection({
                              kind: "element",
                              sectionId: section.id,
                              elementId,
                            })
                          }
                          onUpdateSection={commitSectionUpdate}
                          takeMovingFromContent={takeMovingFromContent}
                        />
                      ))}
                    </div>
                  ) : (
                    <CanvasElementList
                      section={section}
                      selectedElementId={
                        selection.kind === "element" &&
                        selection.sectionId === section.id
                          ? selection.elementId
                          : null
                      }
                      canEdit={canEdit}
                      onSelectElement={(elementId) =>
                        setSelection({
                          kind: "element",
                          sectionId: section.id,
                          elementId,
                        })
                      }
                      onUpdateSection={commitSectionUpdate}
                      takeMovingFromContent={takeMovingFromContent}
                    />
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
        </BuilderDeviceCanvas>

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
    </LandingDevicePreviewProvider>
  );
}

function BuilderDeviceCanvas({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "min-h-0 min-w-0 overflow-auto overscroll-contain bg-[radial-gradient(circle_at_top,hsl(var(--muted)/0.85),hsl(var(--muted)/0.35)_45%,transparent_75%)] [direction:ltr]",
        className,
      )}
    >
      <div className="sticky top-0 z-20 flex justify-center border-b border-border/50 bg-muted/80 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-muted/70 md:hidden">
        <LandingDevicePreviewToolbar />
      </div>
      <LandingDevicePreviewFrame simulateBreakpoints>
        {children}
      </LandingDevicePreviewFrame>
    </div>
  );
}
