"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  FolderOpen,
  Link2,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { filePreviewUrl, formatFileSize } from "@/lib/upload";
import { isClientAssetDisplayImage } from "@/lib/client-asset-images";
import {
  ASSET_GROUP_ORDER,
  ASSET_KIND_LABELS,
  assetGroupKey,
} from "@/lib/contract-workspace";
import type { ClientAssetItem } from "@/components/brief/client-assets-uploader";

export type AssetLibrary = {
  /** Section title, e.g. «دارایی‌های قرارداد». */
  title: string;
  assets: ClientAssetItem[];
  isLoading?: boolean;
};

function previewUrl(asset: ClientAssetItem): string | null {
  if (asset.storageKey && !asset.storageKey.startsWith("ref://")) {
    return (
      filePreviewUrl(asset.storageKey, asset.meta) ||
      (typeof asset.url === "string" ? asset.url : null)
    );
  }
  return typeof asset.url === "string" ? asset.url : null;
}

function LibraryThumb({ asset }: { asset: ClientAssetItem }) {
  const url = previewUrl(asset);
  if (url && isClientAssetDisplayImage(asset.mimeType, asset.name)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={asset.name}
        className="h-12 w-12 shrink-0 rounded-md bg-muted/40 object-contain"
        loading="lazy"
        decoding="async"
      />
    );
  }
  const kind = asset.kind;
  const mime = asset.mimeType || "";
  const Icon =
    kind === "REFERENCE"
      ? Link2
      : kind === "VIDEO" || mime.startsWith("video/")
        ? FileVideo
        : kind === "PRONUNCIATION" || kind === "AUDIO" || mime.startsWith("audio/")
          ? FileAudio
          : kind === "BRANDBOOK" || kind === "CATALOG" || mime.includes("pdf")
            ? FileText
            : FileImage;
  return (
    <div
      className={cn(
        "flex h-12 w-12 shrink-0 items-center justify-center rounded-md",
        kind === "VIDEO"
          ? "bg-neutral-900 text-brand"
          : "bg-muted text-muted-foreground",
      )}
    >
      <Icon className="h-5 w-5" />
    </div>
  );
}

function formatCount(value: number) {
  return value.toLocaleString("fa-AF", { numberingSystem: "latn" });
}

/**
 * Lets the user pick existing files (e.g. the contract «دارایی ها» tab) for a
 * new project instead of listing the whole library automatically.
 */
export function AssetLibraryPicker({
  library,
  selectedIds,
  onSelectedChange,
  disabled,
}: {
  library: AssetLibrary;
  selectedIds: string[];
  onSelectedChange: (ids: string[] | ((prev: string[]) => string[])) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);

  const libraryIds = useMemo(
    () => new Set(library.assets.map((a) => a.id)),
    [library.assets],
  );
  const picked = useMemo(
    () => library.assets.filter((a) => selectedIds.includes(a.id)),
    [library.assets, selectedIds],
  );
  const groups = useMemo(
    () =>
      ASSET_GROUP_ORDER.map((key) => ({
        key,
        label: ASSET_KIND_LABELS[key],
        items: library.assets.filter((a) => assetGroupKey(a.kind) === key),
      })).filter((group) => group.items.length > 0),
    [library.assets],
  );

  const openPicker = () => {
    setDraft(selectedIds.filter((id) => libraryIds.has(id)));
    setOpen(true);
  };

  const apply = () => {
    onSelectedChange((prev) => [
      ...prev.filter((id) => !libraryIds.has(id)),
      ...draft,
    ]);
    setOpen(false);
  };

  const toggleDraft = (id: string, checked: boolean) => {
    setDraft((prev) =>
      checked ? Array.from(new Set([...prev, id])) : prev.filter((x) => x !== id),
    );
  };

  const allSelected =
    library.assets.length > 0 && draft.length === library.assets.length;

  return (
    <div className="space-y-3 rounded-xl border border-brand/20 bg-brand/[0.03] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 text-start">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
            <FolderOpen className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">{library.title}</p>
              {picked.length > 0 ? (
                <Badge variant="brand" className="rounded-full px-2 text-[10px]">
                  {formatCount(picked.length)} انتخاب‌شده
                </Badge>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              فایل‌های لازم برای این ویدیو را از دارایی‌های قرارداد انتخاب کنید
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          disabled={disabled || library.isLoading}
          onClick={openPicker}
        >
          {library.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FolderOpen className="h-4 w-4" />
          )}
          انتخاب از دارایی ها
        </Button>
      </div>

      {picked.length > 0 ? (
        <ul className="space-y-2">
          {picked.map((asset) => (
            <li
              key={asset.id}
              className="flex items-center gap-3 rounded-md border bg-background p-2.5"
            >
              <LibraryThumb asset={asset} />
              <div className="min-w-0 flex-1 text-start">
                <p className="truncate text-sm font-medium">{asset.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {ASSET_KIND_LABELS[assetGroupKey(asset.kind)]}
                  {asset.sizeBytes ? ` · ${formatFileSize(asset.sizeBytes)}` : ""}
                </p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                disabled={disabled}
                onClick={() =>
                  onSelectedChange((prev) => prev.filter((x) => x !== asset.id))
                }
                aria-label={`حذف ${asset.name} از انتخاب`}
                title="حذف از انتخاب"
              >
                <X className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="flex max-h-[85vh] flex-col gap-4 sm:max-w-2xl">
          <DialogHeader className="text-start">
            <DialogTitle className="text-start">انتخاب از دارایی ها</DialogTitle>
            <DialogDescription className="text-start">
              فایل‌هایی که در تب دارایی ها قرارداد آپلود شده‌اند. موارد انتخاب‌شده به
              این ویدیو پیوست می‌شوند.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pe-1">
            {library.assets.length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                هنوز دارایی در تب دارایی ها قرارداد آپلود نشده است.
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    {formatCount(draft.length)} از {formatCount(library.assets.length)} فایل انتخاب شده
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() =>
                      setDraft(allSelected ? [] : library.assets.map((a) => a.id))
                    }
                  >
                    {allSelected ? "لغو انتخاب همه" : "انتخاب همه"}
                  </Button>
                </div>
                {groups.map((group) => (
                  <section key={group.key} className="space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground">
                      {group.label}
                    </h4>
                    <ul className="space-y-2">
                      {group.items.map((asset) => {
                        const checked = draft.includes(asset.id);
                        return (
                          <li key={asset.id}>
                            <label
                              className={cn(
                                "flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 transition-colors",
                                checked
                                  ? "border-brand/40 bg-brand/5"
                                  : "hover:bg-muted/40",
                              )}
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(c) => toggleDraft(asset.id, !!c)}
                              />
                              <LibraryThumb asset={asset} />
                              <div className="min-w-0 flex-1 text-start">
                                <p className="truncate text-sm font-medium">
                                  {asset.name}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  {asset.sizeBytes
                                    ? formatFileSize(asset.sizeBytes)
                                    : ASSET_KIND_LABELS[group.key]}
                                </p>
                              </div>
                              {checked ? (
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-brand" />
                              ) : null}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              انصراف
            </Button>
            <Button
              type="button"
              variant="brand"
              onClick={apply}
              disabled={library.assets.length === 0}
            >
              تایید انتخاب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
