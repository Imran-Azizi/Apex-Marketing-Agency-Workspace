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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onUploaded: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="max-h-[min(90vh,52rem)] overflow-y-auto text-start sm:max-w-2xl"
      >
        <DialogHeader className="text-start sm:text-start">
          <DialogTitle>آپلود دارایی</DialogTitle>
          <DialogDescription>
            فایل را برای همین پروژه بارگذاری کنید. لوگو، تصویر، ویدیو، سند، صوت و لینک مرجع پشتیبانی می‌شود.
          </DialogDescription>
        </DialogHeader>
        <ClientAssetsUploader
          assets={[]}
          selectedIds={[]}
          onSelectedChange={() => {}}
          onRefresh={onUploaded}
          createPath={`/projects/${projectId}/assets`}
          deletePath={(id) => `/projects/${projectId}/assets/${id}`}
          showExistingAssets={false}
          notice="attach"
        />
      </DialogContent>
    </Dialog>
  );
}
