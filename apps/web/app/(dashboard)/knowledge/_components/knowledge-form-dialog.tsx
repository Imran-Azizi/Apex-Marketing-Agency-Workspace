"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFieldArray, useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { apiGet, apiPost, apiPatch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  KnowledgeAttachmentsField,
  type KnowledgeAttachmentsFieldHandle,
} from "./knowledge-attachments-field";
import type { KnowledgeEntry, KnowledgeKind, KnowledgeMeta } from "./types";

const stepSchema = z.object({
  title: z.string().trim().min(1, "عنوان گام الزامی است").max(300),
  body: z.string().trim().max(20000).optional().nullable(),
});

const schema = z.object({
  kind: z.enum(["EXPERIENCE", "POLICY"]),
  title: z.string().trim().min(2, "عنوان باید حداقل ۲ حرف باشد").max(300),
  summary: z.string().trim().max(2000).optional().nullable(),
  body: z.string().trim().max(100000).optional().nullable(),
  category: z.string().trim().max(120).optional().nullable(),
  roleAudience: z.string().optional().nullable(),
  publish: z.boolean().optional(),
  steps: z.array(stepSchema).max(50).optional(),
});

type FormValues = z.infer<typeof schema>;

interface KnowledgeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: KnowledgeEntry | null;
  defaultKind?: KnowledgeKind;
}

export function KnowledgeFormDialog({
  open,
  onOpenChange,
  entry,
  defaultKind = "EXPERIENCE",
}: KnowledgeFormDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(entry);
  const attachmentsRef = useRef<KnowledgeAttachmentsFieldHandle>(null);
  const [uploading, setUploading] = useState(false);

  const { data: meta } = useQuery({
    queryKey: ["knowledge", "meta"],
    queryFn: () => apiGet<KnowledgeMeta>("/knowledge/meta"),
    enabled: open,
  });

  const { data: freshEntry, refetch: refetchEntry } = useQuery({
    queryKey: ["knowledge", "detail", entry?.id],
    queryFn: () => apiGet<KnowledgeEntry>(`/knowledge/${entry!.id}`),
    enabled: open && Boolean(entry?.id),
  });

  const currentEntry = freshEntry || entry || null;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      kind: defaultKind,
      title: "",
      summary: "",
      body: "",
      category: "",
      roleAudience: "",
      publish: true,
      steps: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "steps",
  });

  const watchKind = form.watch("kind");

  useEffect(() => {
    if (!open) return;
    attachmentsRef.current?.clear();
    setUploading(false);
    if (entry) {
      form.reset({
        kind: entry.kind || "EXPERIENCE",
        title: entry.title,
        summary: entry.summary || "",
        body: entry.body || "",
        category: entry.kind === "POLICY" ? "" : entry.category || "",
        roleAudience: entry.roleAudience || "",
        publish: false,
        steps: (entry.steps || []).map((s) => ({
          title: s.title,
          body: s.body || "",
        })),
      });
    } else {
      form.reset({
        kind: defaultKind,
        title: "",
        summary: "",
        body: "",
        category: "",
        roleAudience: "",
        publish: true,
        steps: [],
      });
    }
  }, [open, entry, defaultKind, form]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const isPolicy = values.kind === "POLICY";
      const payload = {
        kind: values.kind,
        title: values.title,
        summary: values.summary || null,
        body: values.body || null,
        category: isPolicy ? null : values.category || null,
        roleAudience: isPolicy ? values.roleAudience || null : null,
        steps: values.steps || [],
        publish: values.publish,
      };
      if (isEdit && entry) {
        const { kind: _k, publish: _p, ...rest } = payload;
        return apiPatch<KnowledgeEntry>(`/knowledge/${entry.id}`, rest);
      }
      return apiPost<KnowledgeEntry>("/knowledge", payload);
    },
  });

  async function onSubmit(values: FormValues) {
    if (values.kind === "POLICY" && !values.roleAudience) {
      toast.error("نقش مخاطب پالیسی را انتخاب کنید");
      return;
    }
    try {
      setUploading(true);
      const result = await mutation.mutateAsync(values);

      if (!isEdit && result?.id && attachmentsRef.current?.hasPending()) {
        const ok = await attachmentsRef.current.uploadPending(result.id);
        if (!ok) {
          toast.error(
            "مورد ذخیره شد، اما برخی فایل‌ها آپلود نشدند. از ویرایش دوباره تلاش کنید.",
          );
          await queryClient.invalidateQueries({ queryKey: ["knowledge"] });
          onOpenChange(false);
          return;
        }
      }

      toast.success(
        isEdit
          ? "ذخیره شد"
          : values.kind === "POLICY"
            ? "پالیسی ثبت شد"
            : "تجربه ثبت شد",
      );
      attachmentsRef.current?.clear();
      await queryClient.invalidateQueries({ queryKey: ["knowledge"] });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در ذخیره");
    } finally {
      setUploading(false);
    }
  }

  const isPolicy = watchKind === "POLICY";
  const categories = meta?.categories || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? isPolicy
                ? "ویرایش پالیسی"
                : "ویرایش تجربه"
              : isPolicy
                ? "ثبت پالیسی شرکت"
                : "ثبت تجربه کاری"}
          </DialogTitle>
          <DialogDescription>
            {isPolicy
              ? "قوانین و معیارهای رسمی شرکت را برای یک نقش مشخص منتشر کنید. فقط همان نقش آن را می‌بیند."
              : "فرآیند کار خود را با متن، گام‌به‌گام و فایل/ویدیو مستند کنید. فقط همکاران هم‌نقش می‌بینند."}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <input type="hidden" {...form.register("kind")} />

          <div className="space-y-2">
            <Label htmlFor="k-title">عنوان</Label>
            <Input id="k-title" {...form.register("title")} />
            {form.formState.errors.title && (
              <p className="text-xs text-destructive">
                {form.formState.errors.title.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="k-summary">خلاصه کوتاه</Label>
            <Textarea id="k-summary" rows={2} {...form.register("summary")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="k-body">
              {isPolicy ? "متن پالیسی / دستورالعمل" : "توضیحات کامل"}
            </Label>
            <Textarea
              id="k-body"
              rows={5}
              placeholder={
                isPolicy
                  ? "قوانین، معیارها و استانداردهای کاری را بنویسید…"
                  : "از اول تا آخر چه کارهایی انجام دادید…"
              }
              {...form.register("body")}
            />
          </div>

          {!isPolicy && (
            <div className="space-y-2">
              <Label>دسته‌بندی</Label>
              <Controller
                control={form.control}
                name="category"
                render={({ field }) => (
                  <Select
                    value={field.value || ""}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="انتخاب دسته" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}

          {isPolicy && (
            <div className="space-y-2">
              <Label>نقش مخاطب پالیسی</Label>
              <Controller
                control={form.control}
                name="roleAudience"
                render={({ field }) => (
                  <Select
                    value={field.value || ""}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="مثلاً ادیتور یا نریتور" />
                    </SelectTrigger>
                    <SelectContent>
                      {(meta?.targetRoles || []).map((r) => (
                        <SelectItem key={r.code} value={r.code}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="text-xs text-muted-foreground">
                فقط کارمندان همین نقش پالیسی را خواهند دید.
              </p>
            </div>
          )}

          {!isPolicy && (
            <div className="space-y-3 rounded-xl border border-border/60 p-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">گام‌به‌گام فرآیند</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ title: "", body: "" })}
                >
                  <Plus className="ml-1 h-3.5 w-3.5" />
                  افزودن گام
                </Button>
              </div>
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="space-y-2 rounded-lg bg-muted/40 p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      گام {index + 1}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Input
                    placeholder="عنوان گام"
                    {...form.register(`steps.${index}.title`)}
                  />
                  <Textarea
                    rows={2}
                    placeholder="توضیح"
                    {...form.register(`steps.${index}.body`)}
                  />
                </div>
              ))}
            </div>
          )}

          <KnowledgeAttachmentsField
            ref={attachmentsRef}
            entryId={isEdit ? currentEntry?.id : null}
            existing={currentEntry?.attachments || []}
            disabled={mutation.isPending}
            onBusyChange={setUploading}
            onExistingChanged={() => {
              void refetchEntry();
              void queryClient.invalidateQueries({ queryKey: ["knowledge"] });
            }}
          />

          {!isEdit && (
            <label className="flex items-center gap-2 text-sm">
              <Controller
                control={form.control}
                name="publish"
                render={({ field }) => (
                  <Checkbox
                    checked={Boolean(field.value)}
                    onCheckedChange={(v) => field.onChange(Boolean(v))}
                  />
                )}
              />
              {isPolicy
                ? "انتشار فوری برای نقش انتخاب‌شده"
                : "انتشار فوری برای همکاران هم‌نقش"}
            </label>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={uploading}
            >
              انصراف
            </Button>
            <Button type="submit" disabled={mutation.isPending || uploading}>
              {mutation.isPending || uploading
                ? uploading
                  ? "در حال آپلود…"
                  : "در حال ذخیره…"
                : isEdit
                  ? "ذخیره"
                  : isPolicy
                    ? "ثبت پالیسی"
                    : "ثبت تجربه"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
