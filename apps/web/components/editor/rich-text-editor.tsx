"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Quote,
  Redo2,
  RemoveFormatting,
  Trash2,
  Underline as UnderlineIcon,
  Undo2,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isEmptyRichText, looksLikeHtml } from "@/lib/rich-text";
import {
  formatFileSize,
  uploadFileWithProgress,
  UPLOAD_PURPOSE,
} from "@/lib/upload";
import { RichTextVideo } from "@/components/editor/rich-text-video";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 120 * 1024 * 1024;

const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/*";
const VIDEO_ACCEPT = "video/mp4,video/webm,video/quicktime,video/*";

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  minHeightClassName?: string;
  dir?: "rtl" | "ltr";
  /** Enable image/video upload toolbar actions (default true). */
  enableMedia?: boolean;
};

type MediaUploadState = {
  kind: "image" | "video";
  progress: number;
  fileName: string;
};

function ToolbarButton({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-8 w-8 shrink-0 rounded-md",
        active && "bg-brand/15 text-brand hover:bg-brand/20 hover:text-brand",
      )}
    >
      {children}
    </Button>
  );
}

function ToolbarDivider() {
  return <span className="mx-0.5 h-5 w-px shrink-0 bg-border/70" aria-hidden />;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "متن را اینجا بنویسید…",
  disabled = false,
  className,
  minHeightClassName = "min-h-[220px]",
  dir = "rtl",
  enableMedia = true,
}: RichTextEditorProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [mediaUpload, setMediaUpload] = useState<MediaUploadState | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: false,
        code: false,
        horizontalRule: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
          class: "text-brand underline underline-offset-2",
        },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
        alignments: ["left", "center", "right", "justify"],
      }),
      Placeholder.configure({ placeholder }),
      Image.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: {
          class: "rich-text-image",
        },
      }),
      RichTextVideo,
    ],
    content: valueToEditorContent(value),
    editorProps: {
      attributes: {
        dir,
        class: cn(
          "prose prose-sm max-w-none px-3 py-3 focus:outline-none",
          "prose-headings:mb-2 prose-headings:mt-4 prose-headings:font-semibold",
          "prose-p:my-2 prose-li:my-0.5 prose-blockquote:border-s-2 prose-blockquote:border-border prose-blockquote:ps-3",
          minHeightClassName,
        ),
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      onChange(isEmptyRichText(html) ? "" : html);
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled && !mediaUpload);
  }, [editor, disabled, mediaUpload]);

  // Sync external value (e.g. dialog open / load existing service).
  useEffect(() => {
    if (!editor) return;
    const next = valueToEditorContent(value);
    const current = editor.getHTML();
    if (normalizeHtml(current) === normalizeHtml(next)) return;
    editor.commands.setContent(next, { emitUpdate: false });
  }, [editor, value]);

  if (!editor) {
    return (
      <div
        className={cn(
          "rounded-xl border border-border/70 bg-muted/20",
          minHeightClassName,
          className,
        )}
      />
    );
  }

  function setLink() {
    if (!editor) return;
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("آدرس لینک", previous || "https://");
    if (url === null) return;
    const trimmed = url.trim();
    if (!trimmed) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: trimmed })
      .run();
  }

  async function uploadMedia(kind: "image" | "video", file: File | null) {
    if (!file || !editor || disabled || mediaUpload) return;

    if (kind === "image") {
      if (!file.type.startsWith("image/")) {
        toast.error("فقط فایل تصویری مجاز است");
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        toast.error(
          `حجم تصویر نباید بیشتر از ${formatFileSize(MAX_IMAGE_BYTES)} باشد`,
        );
        return;
      }
    } else {
      if (!file.type.startsWith("video/")) {
        toast.error("فقط فایل ویدیویی مجاز است");
        return;
      }
      if (file.size > MAX_VIDEO_BYTES) {
        toast.error(
          `حجم ویدیو نباید بیشتر از ${formatFileSize(MAX_VIDEO_BYTES)} باشد`,
        );
        return;
      }
    }

    setMediaUpload({ kind, progress: 0, fileName: file.name });
    try {
      const uploaded = await uploadFileWithProgress(
        file,
        {
          purpose:
            kind === "image"
              ? UPLOAD_PURPOSE.SERVICE_IMAGE
              : UPLOAD_PURPOSE.SERVICE_VIDEO,
        },
        (pct) =>
          setMediaUpload((prev) =>
            prev ? { ...prev, progress: pct } : prev,
          ),
      );

      const src = uploaded.url;
      if (!src) {
        throw new Error("آدرس فایل پس از آپلود در دسترس نیست");
      }

      if (kind === "image") {
        const alt = file.name.replace(/\.[^.]+$/, "") || "تصویر خدمت";
        if (editor.isActive("image")) {
          editor
            .chain()
            .focus()
            .updateAttributes("image", { src, alt })
            .run();
        } else {
          editor.chain().focus().setImage({ src, alt }).run();
        }
      } else if (editor.isActive("richTextVideo")) {
        editor
          .chain()
          .focus()
          .updateAttributes("richTextVideo", { src })
          .run();
      } else {
        editor.chain().focus().setVideo({ src }).run();
      }
      toast.success(kind === "image" ? "تصویر اضافه شد" : "ویدیو اضافه شد");
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : kind === "image"
            ? "آپلود تصویر ناموفق بود"
            : "آپلود ویدیو ناموفق بود",
      );
    } finally {
      setMediaUpload(null);
      if (imageInputRef.current) imageInputRef.current.value = "";
      if (videoInputRef.current) videoInputRef.current.value = "";
    }
  }

  function removeSelectedMedia() {
    if (!editor) return;
    if (editor.isActive("image") || editor.isActive("richTextVideo")) {
      editor.chain().focus().deleteSelection().run();
      return;
    }
    toast.message("ابتدا تصویر یا ویدیو را در متن انتخاب کنید");
  }

  const busy = disabled || Boolean(mediaUpload);
  const mediaSelected =
    editor.isActive("image") || editor.isActive("richTextVideo");

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border/70 bg-background shadow-sm",
        disabled && "opacity-60",
        className,
      )}
      dir={dir}
    >
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border/60 bg-muted/30 px-1.5 py-1.5">
        <ToolbarButton
          title="پررنگ"
          active={editor.isActive("bold")}
          disabled={busy}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="ایتالیک"
          active={editor.isActive("italic")}
          disabled={busy}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="زیرخط"
          active={editor.isActive("underline")}
          disabled={busy}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          title="عنوان ۲"
          active={editor.isActive("heading", { level: 2 })}
          disabled={busy}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          <Heading2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="عنوان ۳"
          active={editor.isActive("heading", { level: 3 })}
          disabled={busy}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
        >
          <Heading3 className="h-3.5 w-3.5" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          title="لیست نقطه‌ای"
          active={editor.isActive("bulletList")}
          disabled={busy}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="لیست شماره‌دار"
          active={editor.isActive("orderedList")}
          disabled={busy}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="نقل‌قول"
          active={editor.isActive("blockquote")}
          disabled={busy}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="h-3.5 w-3.5" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          title="تراز راست"
          active={editor.isActive({ textAlign: "right" })}
          disabled={busy}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        >
          <AlignRight className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="تراز وسط"
          active={editor.isActive({ textAlign: "center" })}
          disabled={busy}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        >
          <AlignCenter className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="تراز چپ"
          active={editor.isActive({ textAlign: "left" })}
          disabled={busy}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        >
          <AlignLeft className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="تراز دوطرفه"
          active={editor.isActive({ textAlign: "justify" })}
          disabled={busy}
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
        >
          <AlignJustify className="h-3.5 w-3.5" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          title="لینک"
          active={editor.isActive("link")}
          disabled={busy}
          onClick={setLink}
        >
          <Link2 className="h-3.5 w-3.5" />
        </ToolbarButton>

        {enableMedia ? (
          <>
            <ToolbarButton
              title="افزودن تصویر"
              disabled={busy}
              onClick={() => imageInputRef.current?.click()}
            >
              <ImagePlus className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton
              title="افزودن ویدیو"
              disabled={busy}
              onClick={() => videoInputRef.current?.click()}
            >
              <Video className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton
              title="حذف رسانه انتخاب‌شده"
              disabled={busy || !mediaSelected}
              onClick={removeSelectedMedia}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </ToolbarButton>
          </>
        ) : null}

        <ToolbarButton
          title="پاک کردن قالب‌بندی"
          disabled={busy}
          onClick={() =>
            editor.chain().focus().unsetAllMarks().clearNodes().run()
          }
        >
          <RemoveFormatting className="h-3.5 w-3.5" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          title="بازگردانی"
          disabled={busy || !editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="از نو"
          disabled={busy || !editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>

      {enableMedia ? (
        <>
          <input
            ref={imageInputRef}
            type="file"
            accept={IMAGE_ACCEPT}
            className="hidden"
            onChange={(e) =>
              uploadMedia("image", e.target.files?.[0] || null)
            }
          />
          <input
            ref={videoInputRef}
            type="file"
            accept={VIDEO_ACCEPT}
            className="hidden"
            onChange={(e) =>
              uploadMedia("video", e.target.files?.[0] || null)
            }
          />
        </>
      ) : null}

      {mediaUpload ? (
        <div
          className="flex items-center gap-3 border-b border-border/60 bg-brand/5 px-3 py-2 text-xs"
          dir="rtl"
        >
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-brand" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-foreground">
              در حال آپلود{" "}
              {mediaUpload.kind === "image" ? "تصویر" : "ویدیو"}…
            </p>
            <p className="truncate text-muted-foreground">
              {mediaUpload.fileName}
            </p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-brand transition-[width] duration-200"
                style={{ width: `${mediaUpload.progress}%` }}
              />
            </div>
          </div>
          <span className="tabular-nums text-muted-foreground">
            {mediaUpload.progress}%
          </span>
        </div>
      ) : null}

      <EditorContent editor={editor} className="max-h-[420px] overflow-y-auto" />

      {enableMedia ? (
        <p className="border-t border-border/50 bg-muted/20 px-3 py-1.5 text-[10px] leading-5 text-muted-foreground">
          تصویر تا {formatFileSize(MAX_IMAGE_BYTES)} و ویدیو تا{" "}
          {formatFileSize(MAX_VIDEO_BYTES)} — برای حذف، رسانه را انتخاب کرده و
          دکمه سطل زباله را بزنید یا Delete را فشار دهید.
        </p>
      ) : null}
    </div>
  );
}

function valueToEditorContent(value: string) {
  const trimmed = (value || "").trim();
  if (!trimmed) return "<p></p>";
  if (looksLikeHtml(trimmed)) return trimmed;
  const escaped = trimmed
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<p>${escaped.replace(/\n/g, "<br>")}</p>`;
}

function normalizeHtml(html: string) {
  return html.replace(/\s+/g, " ").trim();
}
