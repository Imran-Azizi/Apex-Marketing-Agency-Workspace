"use client";

import { useMemo, useState } from "react";
import {
  Download,
  Eye,
  ExternalLink,
  FileAudio,
  FileText,
  FolderOpen,
  LayoutGrid,
  LayoutList,
  Link2,
  Play,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { projectThumbnailUrl } from "@/lib/portal";
import {
  downloadStoredFile,
  formatFileSizeParts,
} from "@/lib/upload";
import {
  getMediaFolderLabel,
  groupAssetsByMediaCategory,
} from "@/lib/media-manager";
import { cn } from "@/lib/utils";

export type PortalProjectAsset = {
  id: string;
  name: string;
  kind: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  storageKey?: string;
  url?: string | null;
  meta?: Record<string, unknown> | null;
  createdAt?: string | null;
};

type SectionId =
  | "LOGO"
  | "PRODUCT_IMAGE"
  | "VIDEO"
  | "DOCUMENT"
  | "AUDIO"
  | "REFERENCE"
  | "OTHER";

const SECTION_META: Array<{
  id: SectionId;
  label: string;
  kinds: string[];
  layout: "media" | "wide" | "row";
}> = [
  { id: "LOGO", label: "لوگو", kinds: ["LOGO"], layout: "media" },
  {
    id: "PRODUCT_IMAGE",
    label: "تصویر محصول",
    kinds: ["PRODUCT_IMAGE"],
    layout: "media",
  },
  { id: "VIDEO", label: "ویدیو", kinds: ["VIDEO"], layout: "wide" },
  {
    id: "DOCUMENT",
    label: "برندبوک / سند",
    kinds: ["BRANDBOOK", "CATALOG"],
    layout: "wide",
  },
  {
    id: "AUDIO",
    label: "فایل صوتی",
    kinds: ["PRONUNCIATION", "AUDIO"],
    layout: "row",
  },
  {
    id: "REFERENCE",
    label: "مراجع و الهام",
    kinds: ["REFERENCE"],
    layout: "row",
  },
  { id: "OTHER", label: "سایر", kinds: ["OTHER"], layout: "media" },
];

const KIND_TO_SECTION = Object.fromEntries(
  SECTION_META.flatMap((s) => s.kinds.map((k) => [k, s.id])),
) as Record<string, SectionId>;

const KIND_LABELS: Record<string, string> = {
  LOGO: "لوگو",
  PRODUCT_IMAGE: "تصویر محصول",
  VIDEO: "ویدیو",
  BRANDBOOK: "برندبوک / سند",
  CATALOG: "کاتالوگ",
  REFERENCE: "مراجع و الهام",
  PRONUNCIATION: "فایل صوتی",
  AUDIO: "فایل صوتی",
  OTHER: "سایر",
};

/** Stable logo card backgrounds so marks read clearly (matches mock). */
const LOGO_BACKDROPS = [
  "bg-[#0b3d2e]",
  "bg-[#f4f1ea]",
  "bg-[#f5d76e]",
  "bg-[#111111]",
  "bg-[#1a365d]",
  "bg-[#f7fafc]",
];

type PreviewState =
  | { type: "video" | "audio" | "image"; url: string; title: string }
  | null;

type ViewMode = "grid" | "list";
type GroupMode = "kind" | "folder";

function sectionForKind(kind: string): SectionId {
  return KIND_TO_SECTION[kind] || "OTHER";
}

function fileTypeLabel(asset: PortalProjectAsset): string {
  const mime = asset.mimeType || "";
  if (mime) {
    const subtype = mime.split("/")[1]?.split(";")[0]?.toUpperCase();
    if (subtype) {
      if (subtype === "JPEG") return "JPG";
      if (subtype === "SVG+XML") return "SVG";
      if (subtype === "MPEG") return "MP3";
      if (subtype === "QUICKTIME") return "MOV";
      if (subtype.length <= 5) return subtype;
    }
  }
  const name = asset.name || "";
  const ext = name.match(/\.([a-zA-Z0-9]{2,5})$/)?.[1];
  if (ext) return ext.toUpperCase();
  if (asset.kind === "REFERENCE") return "LINK";
  if (asset.kind === "VIDEO") return "MP4";
  if (asset.kind === "AUDIO" || asset.kind === "PRONUNCIATION") return "MP3";
  if (asset.kind === "BRANDBOOK" || asset.kind === "CATALOG") return "PDF";
  return "FILE";
}

/** Recover readable filenames (URI-encoded or UTF-8 mojibake). */
function displayAssetName(name: string, kind: string): string {
  if (!name?.trim()) return KIND_LABELS[kind] || "فایل";

  let value = name.trim();

  try {
    if (/%[0-9A-Fa-f]{2}/.test(value)) {
      value = decodeURIComponent(value);
    }
  } catch {
    /* keep original */
  }

  if (/[ÃÂØÙÐÑøù]/.test(value) && !/[\u0600-\u06FF]/.test(value)) {
    try {
      const bytes = Uint8Array.from(value, (ch) => ch.charCodeAt(0) & 0xff);
      const fixed = new TextDecoder("utf-8").decode(bytes);
      if (/[\u0600-\u06FF]/.test(fixed) || fixed.length > 0) {
        value = fixed;
      }
    } catch {
      /* keep value */
    }
  }

  const base = value.split(/[/\\]/).pop() || value;
  const extMatch = base.match(/(\.[a-zA-Z0-9]{2,5})$/);
  const ext = extMatch?.[1]?.toLowerCase() || "";
  const stem = ext ? base.slice(0, -ext.length) : base;
  const looksOpaque =
    stem.length > 40 ||
    /^[a-f0-9-]{20,}$/i.test(stem) ||
    /^blob/i.test(stem) ||
    /^tmp/i.test(stem);

  if (looksOpaque) {
    const kindLabel = KIND_LABELS[kind] || "فایل";
    return ext ? `${kindLabel}${ext}` : kindLabel;
  }

  return base;
}

function hostLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function getRefUrl(asset: PortalProjectAsset): string | null {
  if (typeof asset.meta?.url === "string") return asset.meta.url;
  if (asset.storageKey?.startsWith("ref://")) {
    try {
      return decodeURIComponent(asset.storageKey.slice(6));
    } catch {
      return asset.storageKey.slice(6);
    }
  }
  return null;
}

function EmptyLibrary({
  title,
  description,
  filtered,
  onClear,
}: {
  title: string;
  description: string;
  filtered: boolean;
  onClear?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/70 bg-muted/15 px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand">
        <FolderOpen className="h-7 w-7" />
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold">
          {filtered ? "نتیجه‌ای یافت نشد" : title}
        </p>
        <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
          {filtered
            ? "عبارت جستجو را تغییر دهید تا دارایی‌های بیشتری ببینید."
            : description}
        </p>
      </div>
      {filtered && onClear ? (
        <Button size="sm" variant="outline" onClick={onClear} className="mt-1 gap-1.5">
          <X className="h-3.5 w-3.5" />
          پاک کردن جستجو
        </Button>
      ) : null}
    </div>
  );
}

function PdfMark() {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative flex h-20 w-16 items-center justify-center rounded-lg border border-red-200 bg-gradient-to-b from-red-50 to-white shadow-sm dark:border-red-500/30 dark:from-red-950/60 dark:to-card">
        <FileText className="h-9 w-9 text-red-500" strokeWidth={1.5} />
        <span className="absolute -bottom-2 rounded bg-red-500 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-white">
          PDF
        </span>
      </div>
    </div>
  );
}

export function PortalProjectAssets({
  assets,
  title = "دارایی‌های مشتری",
  description = "لوگو، تصاویر، ویدیو و اسناد",
  emptyTitle = "دارایی‌ای ثبت نشده است",
  emptyDescription = "پس از آپلود لوگو، تصویر، ویدیو یا سند، اینجا نمایش داده می‌شود.",
}: {
  assets: PortalProjectAsset[];
  title?: string;
  description?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const [preview, setPreview] = useState<PreviewState>(null);
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [groupMode, setGroupMode] = useState<GroupMode>("kind");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter((asset) => {
      const name = displayAssetName(asset.name, asset.kind).toLowerCase();
      const kindLabel = (KIND_LABELS[asset.kind] || "").toLowerCase();
      const typeLabel = fileTypeLabel(asset).toLowerCase();
      return (
        name.includes(q) ||
        kindLabel.includes(q) ||
        typeLabel.includes(q) ||
        (asset.mimeType || "").toLowerCase().includes(q)
      );
    });
  }, [assets, query]);

  const grouped = useMemo((): Array<{
    id: string;
    label: string;
    layout: "media" | "wide" | "row";
    items: PortalProjectAsset[];
  }> => {
    if (groupMode === "folder") {
      return groupAssetsByMediaCategory(filtered).map((group) => ({
        id: group.id,
        label: group.label,
        layout: "media" as const,
        items: group.items as PortalProjectAsset[],
      }));
    }

    const map = new Map<SectionId, PortalProjectAsset[]>();
    for (const asset of filtered) {
      const key = sectionForKind(asset.kind);
      const list = map.get(key) || [];
      list.push(asset);
      map.set(key, list);
    }
    return SECTION_META.filter((s) => map.has(s.id)).map((s) => ({
      id: s.id,
      label: s.label,
      layout: s.layout,
      items: map.get(s.id)!,
    }));
  }, [filtered, groupMode]);

  const openPreview = (asset: PortalProjectAsset, titleText: string) => {
    const refUrl = getRefUrl(asset);
    const isReference = asset.kind === "REFERENCE" || Boolean(refUrl);
    if (isReference && refUrl) {
      window.open(refUrl, "_blank", "noopener,noreferrer");
      return;
    }
    const url =
      asset.storageKey && !isReference
        ? projectThumbnailUrl(asset.storageKey, {
            url: asset.url,
            meta: asset.meta,
          })
        : null;
    if (!url) {
      toast.message("پیش‌نمایش برای این فایل در دسترس نیست");
      return;
    }
    const mime = asset.mimeType || "";
    if (mime.startsWith("image/") || asset.kind === "LOGO" || asset.kind === "PRODUCT_IMAGE") {
      setPreview({ type: "image", url, title: titleText });
      return;
    }
    if (mime.startsWith("video/") || asset.kind === "VIDEO") {
      setPreview({ type: "video", url, title: titleText });
      return;
    }
    if (
      mime.startsWith("audio/") ||
      asset.kind === "AUDIO" ||
      asset.kind === "PRONUNCIATION"
    ) {
      setPreview({ type: "audio", url, title: titleText });
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const sizeLabel = (asset: PortalProjectAsset) => {
    const parts = formatFileSizeParts(asset.sizeBytes);
    if (!parts) return null;
    return (
      <span dir="ltr" className="inline-flex items-baseline gap-1 tabular-nums">
        <span>{parts.value}</span>
        <span>{parts.unit}</span>
      </span>
    );
  };

  const handleDownload = async (asset: PortalProjectAsset, titleText: string) => {
    if (!asset.storageKey || asset.storageKey.startsWith("ref://")) {
      toast.error("فایل قابل دانلود نیست");
      return;
    }
    try {
      setDownloadingId(asset.id);
      await downloadStoredFile(asset.storageKey, titleText);
    } catch {
      toast.error("دانلود ناموفق بود");
    } finally {
      setDownloadingId(null);
    }
  };

  const renderMediaCard = (
    asset: PortalProjectAsset,
    index: number,
    _section?: string,
  ) => {
    const refUrl = getRefUrl(asset);
    const isReference = asset.kind === "REFERENCE" || Boolean(refUrl);
    const previewUrl =
      asset.storageKey && !isReference
        ? projectThumbnailUrl(asset.storageKey, {
            url: asset.url,
            meta: asset.meta,
          })
        : null;
    const downloadUrl =
      asset.storageKey && !isReference ? asset.storageKey : null;
    const titleText = displayAssetName(asset.name, asset.kind);
    const kindSection = sectionForKind(asset.kind);
    const folderLabel =
      asset.storageKey && !asset.storageKey.startsWith("ref://")
        ? getMediaFolderLabel(asset.storageKey, {
            mimeType: asset.mimeType,
            meta: asset.meta,
          })
        : null;
    const isLogo = kindSection === "LOGO";
    const isVideo = kindSection === "VIDEO";
    const isDoc = kindSection === "DOCUMENT";
    const isAudio = kindSection === "AUDIO";
    const primaryLabel = isVideo ? "پخش" : isReference ? "باز کردن لینک" : "مشاهده";
    const PrimaryIcon = isVideo ? Play : isReference ? ExternalLink : Eye;
    const sizeNode = sizeLabel(asset);

    return (
      <li
        key={asset.id}
        className="group flex flex-col overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
      >
        <button
          type="button"
          onClick={() => openPreview(asset, titleText)}
          className={cn(
            "relative w-full overflow-hidden text-start",
            isLogo ? "aspect-square" : "aspect-[16/10]",
            isLogo
              ? LOGO_BACKDROPS[index % LOGO_BACKDROPS.length]
              : isDoc || isAudio || isReference
                ? "bg-muted/40"
                : "bg-muted/30",
          )}
        >
          {isLogo && previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={titleText}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-contain p-6 transition-transform duration-300 group-hover:scale-[1.03]"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                if (process.env.NODE_ENV !== "production") {
                  console.warn("[portal-asset] image failed:", previewUrl);
                }
              }}
            />
          ) : null}

          {!isLogo &&
          !isVideo &&
          !isDoc &&
          !isAudio &&
          !isReference &&
          previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={titleText}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                if (process.env.NODE_ENV !== "production") {
                  console.warn("[portal-asset] image failed:", previewUrl);
                }
              }}
            />
          ) : null}

          {isVideo ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900">
              <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.2),transparent_45%),radial-gradient(circle_at_70%_80%,rgba(20,184,166,0.35),transparent_40%)]" />
              <span className="relative z-[1] flex h-12 w-12 items-center justify-center rounded-full bg-background/90 text-foreground shadow-lg ring-1 ring-black/5 transition group-hover:scale-105 dark:ring-white/10">
                <Play className="ms-0.5 h-5 w-5 fill-current" />
              </span>
            </div>
          ) : null}

          {isDoc ? (
            <div className="flex h-full items-center justify-center">
              <PdfMark />
            </div>
          ) : null}

          {(isAudio || (isLogo && !previewUrl)) && !isDoc ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              {isAudio ? (
                <FileAudio className="h-12 w-12 text-brand/70" strokeWidth={1.4} />
              ) : (
                <span className="text-sm font-medium opacity-70">لوگو</span>
              )}
            </div>
          ) : null}

          {isReference ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <Link2 className="h-10 w-10 text-brand/70" strokeWidth={1.4} />
              {refUrl ? (
                <span className="max-w-[85%] truncate px-3 text-[11px]">
                  {hostLabel(refUrl)}
                </span>
              ) : null}
            </div>
          ) : null}

          {!previewUrl && !isDoc && !isAudio && !isReference && !isLogo ? (
            <div className="flex h-full items-center justify-center bg-muted/50 text-muted-foreground">
              <span className="text-xs">{fileTypeLabel(asset)}</span>
            </div>
          ) : null}
        </button>

        <div className="flex flex-1 flex-col gap-3 p-3.5">
          <div className="min-w-0 space-y-1 text-center">
            <p
              className="truncate text-sm font-semibold leading-snug tracking-tight text-foreground"
              title={titleText}
            >
              <bdi dir="ltr" className="inline">
                {titleText}
              </bdi>
            </p>
            <p className="text-[11px] font-medium text-muted-foreground">
              {sizeNode || (isReference && refUrl ? hostLabel(refUrl) : "—")}
            </p>
            {folderLabel ? (
              <Badge variant="outline" className="mx-auto mt-1 text-[10px] font-normal">
                {folderLabel}
              </Badge>
            ) : null}
          </div>

          <div className="mt-auto grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-9 gap-1.5 rounded-lg text-xs"
            onClick={() => openPreview(asset, titleText)}
          >
            <PrimaryIcon className="h-3.5 w-3.5" />
            {primaryLabel}
          </Button>
          {downloadUrl ? (
            <Button
              size="sm"
              variant="brand"
              className="h-9 gap-1.5 rounded-lg text-xs"
              disabled={downloadingId === asset.id}
              onClick={() => void handleDownload(asset, titleText)}
            >
              <Download className="h-3.5 w-3.5" />
              {downloadingId === asset.id ? "…" : "دانلود"}
            </Button>
          ) : isReference && refUrl ? (
            <Button
              asChild
              size="sm"
              variant="brand"
              className="h-9 gap-1.5 rounded-lg text-xs"
            >
              <a href={refUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                لینک
              </a>
            </Button>
          ) : (
            <Button
              size="sm"
              variant="brand"
              className="h-9 gap-1.5 rounded-lg text-xs"
              disabled
            >
              <Download className="h-3.5 w-3.5" />
              دانلود
            </Button>
          )}
          </div>
        </div>
      </li>
    );
  };

  const renderRowCard = (asset: PortalProjectAsset, _section?: string) => {
    const refUrl = getRefUrl(asset);
    const kindSection = sectionForKind(asset.kind);
    const isReference =
      kindSection === "REFERENCE" ||
      asset.kind === "REFERENCE" ||
      Boolean(refUrl);
    const canDownload = Boolean(asset.storageKey && !isReference);
    const titleText = displayAssetName(asset.name, asset.kind);

    return (
      <li
        key={asset.id}
        className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-3.5 shadow-sm transition-all duration-200 hover:shadow-md sm:flex-row sm:items-center sm:gap-4"
      >
        <div
          className={cn(
            "flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-border/60",
            isReference ? "bg-sky-500/10 text-sky-700 dark:text-sky-300" : "bg-brand/10 text-brand",
          )}
        >
          {isReference ? (
            <Link2 className="h-6 w-6" strokeWidth={1.6} />
          ) : (
            <FileAudio className="h-6 w-6" strokeWidth={1.6} />
          )}
        </div>

        <div className="min-w-0 flex-1 text-start">
          <p className="truncate text-sm font-semibold tracking-tight" title={titleText}>
            <bdi dir="ltr" className="inline">
              {titleText}
            </bdi>
          </p>
          <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
            {sizeLabel(asset) || (isReference && refUrl ? hostLabel(refUrl) : "—")}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-9 gap-1.5 rounded-lg text-xs"
            onClick={() => openPreview(asset, titleText)}
          >
            {isReference ? (
              <ExternalLink className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            {isReference ? "باز کردن لینک" : "پخش"}
          </Button>
          {canDownload ? (
            <Button
              size="sm"
              variant="brand"
              className="h-9 gap-1.5 rounded-lg text-xs"
              disabled={downloadingId === asset.id}
              onClick={() => void handleDownload(asset, titleText)}
            >
              <Download className="h-3.5 w-3.5" />
              {downloadingId === asset.id ? "…" : "دانلود"}
            </Button>
          ) : null}
        </div>
      </li>
    );
  };

  const renderListRow = (asset: PortalProjectAsset, _section?: string) => {
    const refUrl = getRefUrl(asset);
    const kindSection = sectionForKind(asset.kind);
    const isReference =
      kindSection === "REFERENCE" ||
      asset.kind === "REFERENCE" ||
      Boolean(refUrl);
    const previewUrl =
      asset.storageKey && !isReference
        ? projectThumbnailUrl(asset.storageKey, {
            url: asset.url,
            meta: asset.meta,
          })
        : null;
    const downloadUrl =
      asset.storageKey && !isReference
        ? asset.storageKey
        : null;
    const titleText = displayAssetName(asset.name, asset.kind);
    const isVideo = kindSection === "VIDEO";

    return (
      <li
        key={asset.id}
        className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-3 transition-shadow hover:shadow-sm sm:flex-row sm:items-center"
      >
        <button
          type="button"
          className="relative h-16 w-full shrink-0 overflow-hidden rounded-lg bg-muted/40 sm:w-24"
          onClick={() => openPreview(asset, titleText)}
        >
          {previewUrl && (kindSection === "LOGO" || kindSection === "PRODUCT_IMAGE") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt=""
              loading="lazy"
              className={cn(
                "h-full w-full",
                kindSection === "LOGO" ? "object-contain p-2" : "object-cover",
              )}
            />
          ) : kindSection === "DOCUMENT" ? (
            <div className="flex h-full items-center justify-center">
              <FileText className="h-6 w-6 text-red-500" />
            </div>
          ) : isReference ? (
            <div className="flex h-full items-center justify-center">
              <Link2 className="h-5 w-5 text-brand" />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <FileAudio className="h-5 w-5 text-brand" />
            </div>
          )}
          {isVideo ? (
            <span className="absolute inset-0 flex items-center justify-center bg-black/20">
              <Play className="h-4 w-4 fill-white text-white" />
            </span>
          ) : null}
        </button>

        <div className="min-w-0 flex-1 text-start">
          <p className="truncate text-sm font-semibold tracking-tight">{titleText}</p>
          <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
            {sizeLabel(asset) || (refUrl ? hostLabel(refUrl) : "—")}
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 text-xs"
            onClick={() => openPreview(asset, titleText)}
          >
            {isVideo ? <Play className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {isVideo ? "پخش" : isReference ? "لینک" : "مشاهده"}
          </Button>
          {downloadUrl ? (
            <Button
              size="sm"
              variant="brand"
              className="h-8 gap-1 text-xs"
              disabled={downloadingId === asset.id}
              onClick={() => void handleDownload(asset, titleText)}
            >
              <Download className="h-3.5 w-3.5" />
              {downloadingId === asset.id ? "…" : "دانلود"}
            </Button>
          ) : null}
        </div>
      </li>
    );
  };

  return (
    <>
      <div dir="rtl" className="space-y-5 text-start">
        {/* Toolbar — matches mock: title + search/actions */}
        <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card px-4 py-4 shadow-sm sm:px-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-0.5">
            <h2 className="text-base font-semibold tracking-tight sm:text-lg">
              {title}
            </h2>
            <p className="text-xs text-muted-foreground sm:text-sm">{description}</p>
          </div>

          <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:items-center lg:w-auto">
            <div className="relative min-w-0 flex-1 lg:w-64">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="جستجوی دارایی‌ها..."
                className="h-10 rounded-xl border-border/70 bg-background ps-9"
              />
            </div>

            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className="h-9 shrink-0 rounded-xl px-3 text-xs font-medium tabular-nums"
              >
                {assets.length.toLocaleString("fa-AF", { numberingSystem: "latn" })} مورد
              </Badge>

              <div className="flex items-center rounded-xl border border-border/70 bg-background p-1">
                <Button
                  type="button"
                  size="sm"
                  variant={groupMode === "kind" ? "secondary" : "ghost"}
                  className="h-7 px-2 text-[11px]"
                  onClick={() => setGroupMode("kind")}
                >
                  نوع
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={groupMode === "folder" ? "secondary" : "ghost"}
                  className="h-7 px-2 text-[11px]"
                  onClick={() => setGroupMode("folder")}
                >
                  پوشه
                </Button>
              </div>

              <div className="flex items-center rounded-xl border border-border/70 bg-background p-1">
                <Button
                  type="button"
                  size="sm"
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  className="h-7 w-8 px-0"
                  onClick={() => setViewMode("grid")}
                  aria-label="نمایش شبکه‌ای"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  className="h-7 w-8 px-0"
                  onClick={() => setViewMode("list")}
                  aria-label="نمایش لیستی"
                >
                  <LayoutList className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-8">
          {!assets.length ? (
            <EmptyLibrary title={emptyTitle} description={emptyDescription} filtered={false} />
          ) : !filtered.length ? (
            <EmptyLibrary
              title={emptyTitle}
              description={emptyDescription}
              filtered
              onClear={() => setQuery("")}
            />
          ) : (
            grouped.map((group) => (
              <section key={group.id} className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">
                  {group.label}
                </h3>

                {viewMode === "list" ? (
                  <ul className="space-y-2.5">
                    {group.items.map((asset) => renderListRow(asset, group.id))}
                  </ul>
                ) : group.layout === "row" ? (
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {group.items.map((asset) => renderRowCard(asset, group.id))}
                  </ul>
                ) : (
                  <ul
                    className={cn(
                      "grid gap-3.5",
                      group.layout === "wide"
                        ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                        : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
                    )}
                  >
                    {group.items.map((asset, index) =>
                      renderMediaCard(asset, index, group.id),
                    )}
                  </ul>
                )}
              </section>
            ))
          )}
        </div>
      </div>

      <Dialog
        open={Boolean(preview)}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
      >
        <DialogContent dir="rtl" className="text-start sm:max-w-3xl">
          <DialogHeader className="text-start sm:text-start">
            <DialogTitle className="line-clamp-2">
              {preview?.title || "پیش‌نمایش"}
            </DialogTitle>
          </DialogHeader>
          {preview?.type === "image" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview.url}
              alt={preview.title}
              className="max-h-[75vh] w-full rounded-xl bg-muted object-contain"
            />
          )}
          {preview?.type === "video" && (
            <video
              src={preview.url}
              controls
              autoPlay
              className="w-full rounded-xl bg-black"
            />
          )}
          {preview?.type === "audio" && (
            <div className="rounded-xl border bg-muted/30 p-5">
              <audio src={preview.url} controls autoPlay className="w-full" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
