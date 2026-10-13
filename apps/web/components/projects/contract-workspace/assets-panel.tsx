"use client";

import { useCallback, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  FolderOpen,
  Loader2,
  Pencil,
  RefreshCw,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { apiDelete, apiPatch } from "@/lib/api";
import {
  referenceUrl,
  type ContractAsset,
  type ContractWorkspace,
} from "@/lib/contract-workspace";
import {
  CLIENT_ASSET_LOGO_ACCEPT,
  CLIENT_ASSET_PRODUCT_IMAGE_ACCEPT,
  validateClientAssetImageFile,
} from "@/lib/client-asset-images";
import { UPLOAD_PURPOSE, mergeUploadStorageMeta } from "@/lib/media-manager";
import {
  detectReferenceProvider,
  formatFileSize,
  isValidReferenceUrl,
  readVideoDuration,
  uploadFileWithProgress,
} from "@/lib/upload";
import {
  ClientAssetsUploader,
  IDLE_ASSET_UPLOAD_STATE,
  type AssetUploadState,
} from "@/components/brief/client-assets-uploader";
import { ContractAssetsGrid } from "@/components/contract-content/asset-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PanelHeader } from "./panel-header";

const NOOP = () => undefined;

function acceptForKind(kind: string): string {
  switch (kind) {
    case "LOGO":
      return CLIENT_ASSET_LOGO_ACCEPT;
    case "PRODUCT_IMAGE":
      return CLIENT_ASSET_PRODUCT_IMAGE_ACCEPT;
    case "VIDEO":
      return "video/*,.mp4,.mov,.webm,.mkv";
    case "BRANDBOOK":
    case "CATALOG":
      return ".pdf,.docx,.pptx,application/pdf";
    case "PRONUNCIATION":
    case "AUDIO":
      return "audio/*,.mp3,.wav,.m4a";
    default:
      return "";
  }
}

function UploadAssetsDialog({
  open,
  onOpenChange,
  projectId,
  assets,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  assets: ContractAsset[];
}) {
  const queryClient = useQueryClient();
  const [uploadState, setUploadState] = useState<AssetUploadState>(IDLE_ASSET_UPLOAD_STATE);
  const onUploadStateChange = useCallback((state: AssetUploadState) => setUploadState(state), []);
  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["contract-workspace", projectId] });
  }, [queryClient, projectId]);

  const requestClose = (next: boolean) => {
    if (!next && uploadState.isUploading) {
      toast.error("تا پایان آپلود فایل‌ها صبر کنید");
      return;
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={requestClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>آپلود دارایی‌ها</DialogTitle>
          <DialogDescription>
            فایل‌های برند را در بخش مربوط آپلود کنید؛ هر فایل بلافاصله ذخیره می‌شود.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <ClientAssetsUploader
            assets={assets}
            selectedIds={[]}
            onSelectedChange={NOOP}
            onRefresh={refresh}
            onUploadStateChange={onUploadStateChange}
            createPath={`/projects/${projectId}/workspace/assets`}
            deletePath={(id) => `/projects/${projectId}/workspace/assets/${id}`}
            showExistingAssets={false}
            notice="attach"
          />
        ) : null}
        <DialogFooter>
          <Button
            variant="brand"
            onClick={() => requestClose(false)}
            disabled={uploadState.isUploading}
          >
            {uploadState.isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            اتمام
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditAssetDialog({
  projectId,
  asset,
  onClose,
}: {
  projectId: string;
  asset: ContractAsset | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [link, setLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [current, setCurrent] = useState<ContractAsset | null>(null);
  if (asset !== current) {
    setCurrent(asset);
    if (asset) {
      setName(asset.name);
      setNote(asset.note || "");
      setLink(referenceUrl(asset) || "");
      setFile(null);
      setProgress(null);
    }
  }
  const isReference = asset?.kind === "REFERENCE";

  const save = useMutation({
    mutationFn: async () => {
      if (!asset) return;
      if (!name.trim()) throw new Error("نام فایل الزامی است");
      const body: Record<string, unknown> = { name: name.trim(), note: note.trim() || null };

      if (isReference) {
        const url = link.trim();
        if (!isValidReferenceUrl(url)) throw new Error("لینک معتبر نیست");
        if (url !== referenceUrl(asset)) {
          body.file = {
            name: name.trim(),
            storageKey: `ref://${encodeURIComponent(url)}`,
            mimeType: "text/uri-list",
            sizeBytes: 0,
            meta: { url, provider: detectReferenceProvider(url) },
          };
        }
      } else if (file) {
        const meta: Record<string, unknown> = {};
        if (asset.kind === "VIDEO") {
          const duration = await readVideoDuration(file);
          if (duration != null) meta.durationSec = duration;
        }
        setProgress(0);
        const uploaded = await uploadFileWithProgress(
          file,
          { purpose: UPLOAD_PURPOSE.PORTAL_ASSET, assetKind: asset.kind },
          (percent) => setProgress(percent),
        );
        body.file = {
          name: uploaded.name || file.name,
          storageKey: uploaded.key,
          mimeType: uploaded.mimeType || file.type,
          sizeBytes: uploaded.sizeBytes ?? file.size,
          meta: mergeUploadStorageMeta(meta, uploaded),
        };
      }
      return apiPatch(`/projects/${projectId}/workspace/assets/${asset.id}`, body);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["contract-workspace", projectId] });
      toast.success("دارایی به‌روزرسانی شد");
      onClose();
    },
    onError: (error) => {
      setProgress(null);
      toast.error(error instanceof Error ? error.message : "ذخیره ناموفق بود");
    },
  });

  const pickFile = (picked: File | undefined) => {
    if (!picked || !asset) return;
    if (asset.kind === "LOGO" || asset.kind === "PRODUCT_IMAGE") {
      const check = validateClientAssetImageFile(picked, asset.kind);
      if (!check.ok) {
        toast.error(check.message);
        return;
      }
    }
    setFile(picked);
    setName(picked.name);
  };

  return (
    <Dialog
      open={Boolean(asset)}
      onOpenChange={(open) => {
        if (!open && !save.isPending) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>ویرایش دارایی</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="asset-name">نام فایل</Label>
            <Input id="asset-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          {isReference ? (
            <div className="space-y-1.5">
              <Label htmlFor="asset-link">آدرس لینک</Label>
              <Input
                id="asset-link"
                dir="ltr"
                value={link}
                placeholder="https://..."
                onChange={(event) => setLink(event.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>فایل</Label>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-border bg-muted/20 p-3">
                <div className="min-w-0 text-sm">
                  <p className="truncate font-medium">{file ? file.name : asset?.name}</p>
                  <p className="text-xs text-muted-foreground" dir="ltr">
                    {formatFileSize(file ? file.size : asset?.sizeBytes)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  disabled={save.isPending}
                  onClick={() => inputRef.current?.click()}
                >
                  <RefreshCw className="h-4 w-4" />
                  جایگزینی فایل
                </Button>
                <input
                  ref={inputRef}
                  type="file"
                  className="hidden"
                  accept={asset ? acceptForKind(asset.kind) : undefined}
                  onChange={(event) => {
                    pickFile(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </div>
              {progress != null ? (
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-brand transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              ) : null}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="asset-note">توضیحات (اختیاری)</Label>
            <Textarea
              id="asset-note"
              rows={3}
              value={note}
              placeholder="مثلاً نسخه رنگی لوگو برای پس‌زمینه تیره"
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            انصراف
          </Button>
          <Button variant="brand" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            ذخیره تغییرات
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AssetsPanel({
  projectId,
  workspace,
  canEdit,
}: {
  projectId: string;
  workspace: ContractWorkspace;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editing, setEditing] = useState<ContractAsset | null>(null);
  const [deleting, setDeleting] = useState<ContractAsset | null>(null);
  const assets = workspace.assets;

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/projects/${projectId}/workspace/assets/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["contract-workspace", projectId] });
      toast.success("دارایی حذف شد");
      setDeleting(null);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "حذف ناموفق بود");
    },
  });

  return (
    <div className="space-y-5">
      <PanelHeader
        icon={<FolderOpen className="h-5 w-5" />}
        title="دارایی ها"
        actions={
          canEdit ? (
            <Button
              variant="brand"
              size="sm"
              className="rounded-xl"
              onClick={() => setUploadOpen(true)}
            >
              <UploadCloud className="h-4 w-4" />
              آپلود دارایی
            </Button>
          ) : null
        }
      />

      {assets.length ? (
        <ContractAssetsGrid
          assets={assets}
          renderActions={
            canEdit
              ? (asset) => (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-brand"
                      title="ویرایش"
                      aria-label={`ویرایش ${asset.name}`}
                      onClick={() => setEditing(asset)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      title="حذف"
                      aria-label={`حذف ${asset.name}`}
                      onClick={() => setDeleting(asset)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )
              : undefined
          }
        />
      ) : (
        <div className="rounded-2xl border border-dashed bg-muted/20 px-4 py-10 text-center">
          <p className="font-semibold">هنوز دارایی‌ای آپلود نشده</p>
          {canEdit ? (
            <Button variant="brand" className="mt-4 rounded-xl" onClick={() => setUploadOpen(true)}>
              <UploadCloud className="h-4 w-4" />
              آپلود دارایی
            </Button>
          ) : null}
        </div>
      )}

      {canEdit ? (
        <>
          <UploadAssetsDialog
            open={uploadOpen}
            onOpenChange={setUploadOpen}
            projectId={projectId}
            assets={assets}
          />
          <EditAssetDialog projectId={projectId} asset={editing} onClose={() => setEditing(null)} />
          <Dialog
            open={Boolean(deleting)}
            onOpenChange={(open) => {
              if (!open && !remove.isPending) setDeleting(null);
            }}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                  <AlertTriangle className="h-6 w-6 text-destructive" />
                </div>
                <DialogTitle>حذف دارایی</DialogTitle>
                <DialogDescription>
                  «{deleting?.name}» حذف شود؟ این عمل قابل بازگشت نیست.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setDeleting(null)} disabled={remove.isPending}>
                  انصراف
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => deleting && remove.mutate(deleting.id)}
                  disabled={remove.isPending}
                >
                  {remove.isPending ? "در حال حذف..." : "بله، حذف شود"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </div>
  );
}
