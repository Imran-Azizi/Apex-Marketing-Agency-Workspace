"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiPatch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { VideoStorageItem } from "./types";

export function VideoEditDialog({
  item,
  open,
  onOpenChange,
  canSetReviewStatus,
  onUpdated,
}: {
  item: VideoStorageItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canSetReviewStatus?: boolean;
  onUpdated: (item: VideoStorageItem) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"UPLOADED" | "UNDER_REVIEW">("UPLOADED");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!item || !open) return;
    setTitle(item.title);
    setDescription(item.description || "");
    setStatus(
      item.status === "UNDER_REVIEW" ? "UNDER_REVIEW" : "UPLOADED",
    );
  }, [item, open]);

  async function handleSave() {
    if (!item) return;
    if (!title.trim()) {
      toast.error("عنوان الزامی است");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || null,
      };
      if (
        canSetReviewStatus &&
        !item.inPortfolio &&
        (item.status === "UPLOADED" || item.status === "UNDER_REVIEW")
      ) {
        payload.status = status;
      }
      const updated = await apiPatch<VideoStorageItem>(
        `/video-storage/${item.id}`,
        payload,
      );
      toast.success("اطلاعات ویدیو به‌روزرسانی شد");
      onUpdated(updated);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ویرایش ناموفق بود");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="text-start sm:max-w-md" dir="rtl">
        <DialogHeader className="text-start">
          <DialogTitle>ویرایش ویدیو</DialogTitle>
          <DialogDescription>
            عنوان، توضیحات و وضعیت بررسی را به‌روز کنید.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-title">عنوان</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-xl"
              maxLength={200}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-desc">توضیحات</Label>
            <Textarea
              id="edit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-24 rounded-xl"
              maxLength={4000}
            />
          </div>
          {canSetReviewStatus &&
          item &&
          !item.inPortfolio &&
          (item.status === "UPLOADED" || item.status === "UNDER_REVIEW") ? (
            <div className="space-y-2">
              <Label>وضعیت گردش‌کار</Label>
              <Select
                value={status}
                onValueChange={(v) =>
                  setStatus(v as "UPLOADED" | "UNDER_REVIEW")
                }
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UPLOADED">آپلود شد</SelectItem>
                  <SelectItem value="UNDER_REVIEW">در حال بررسی</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
        <DialogFooter className="gap-2 sm:justify-start">
          <Button
            variant="brand"
            className="rounded-xl"
            disabled={saving}
            onClick={handleSave}
          >
            {saving ? "در حال ذخیره…" : "ذخیره"}
          </Button>
          <Button
            variant="outline"
            className="rounded-xl"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            انصراف
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
