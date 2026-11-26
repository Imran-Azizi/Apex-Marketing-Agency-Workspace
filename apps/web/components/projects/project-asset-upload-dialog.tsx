"use client";

import { ClientAssetsUploader } from "@/components/brief/client-assets-uploader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ProjectAssetUploadDialog({
  open,
  onOpenChange,
  projectId,
  onUploaded,
  createPath,
  deletePath,
  description = "فایل را برای همین پروژه بارگذاری کنید. لوگو، تصویر، ویدیو، سند، صوت و لینک مرجع پشتیبانی می‌شود.",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onUploaded: () => void;
  /** Defaults to staff project attach API; portal passes `/portal/projects/:id/assets`. */
  createPath?: string;
  deletePath?: (id: string) => string;
  description?: string;
}) {
  const resolvedCreatePath = createPath || `/projects/${projectId}/assets`;
  const resolvedDeletePath =
    deletePath || ((id: string) => `/projects/${projectId}/assets/${id}`);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="max-h-[min(90vh,52rem)] overflow-y-auto text-start sm:max-w-2xl"
      >
        <DialogHeader className="text-start sm:text-start">
          <DialogTitle>آپلود دارایی</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <ClientAssetsUploader
          assets={[]}
          selectedIds={[]}
          onSelectedChange={() => {}}
          onRefresh={onUploaded}
          createPath={resolvedCreatePath}
          deletePath={resolvedDeletePath}
          showExistingAssets={false}
          notice="attach"
        />
      </DialogContent>
    </Dialog>
  );
}
