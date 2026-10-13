"use client";

import { useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ExternalLink,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  Link2,
  Loader2,
  Maximize2,
  Pause,
  Play,
} from "lucide-react";
import { resolveAssetSrc } from "@/lib/api";
import { formatFileSize } from "@/lib/upload";
import { isClientAssetDisplayImage } from "@/lib/client-asset-images";
import {
  ASSET_GROUP_ORDER,
  ASSET_KIND_LABELS,
  assetGroupKey,
  referenceUrl,
  type ContractAsset,
} from "@/lib/contract-workspace";
import { formatCount } from "@/lib/contract-project";
import { formatDate } from "@/lib/utils";
import { VideoPlayer } from "@/components/media/video-player";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type MediaType = "image" | "video" | "audio" | null;

function KindIcon({ asset }: { asset: ContractAsset }) {
  const className = "h-7 w-7";
  if (asset.kind === "REFERENCE") return <Link2 className={className} />;
  if (asset.kind === "VIDEO" || asset.mimeType?.startsWith("video/")) {
    return <FileVideo className={className} />;
  }
  if (
    asset.kind === "PRONUNCIATION" ||
    asset.kind === "AUDIO" ||
    asset.mimeType?.startsWith("audio/")
  ) {
    return <FileAudio className={className} />;
  }
  if (asset.kind === "BRANDBOOK" || asset.kind === "CATALOG" || asset.mimeType?.includes("pdf")) {
    return <FileText className={className} />;
  }
  return <FileImage className={className} />;
}

export function contractAssetHref(asset: ContractAsset): string | null {
  if (asset.kind === "REFERENCE") return referenceUrl(asset);
  return resolveAssetSrc({ url: asset.url, storageKey: asset.storageKey, meta: asset.meta });
}

function assetMediaType(asset: ContractAsset): MediaType {
  if (asset.kind === "REFERENCE") return null;
  if (isClientAssetDisplayImage(asset.mimeType, asset.name)) return "image";
  if (asset.kind === "VIDEO" || asset.mimeType?.startsWith("video/")) return "video";
  if (
    asset.kind === "PRONUNCIATION" ||
    asset.kind === "AUDIO" ||
    asset.mimeType?.startsWith("audio/")
  ) {
    return "audio";
  }
  return null;
}

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = String(total % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

/** Compact audio player sized for cards; native controls collapse at this width. */
function InlineAudioPlayer({ src, autoPlay = false }: { src: string; autoPlay?: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [failed, setFailed] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  const toggle = async () => {
    const el = audioRef.current;
    if (!el) return;
    if (!el.paused) {
      el.pause();
      return;
    }
    setFailed(false);
    setBuffering(true);
    try {
      await el.play();
    } catch {
      setFailed(true);
    } finally {
      setBuffering(false);
    }
  };

  return (
    <div dir="ltr" className="flex w-full items-center gap-2 rounded-full border border-border/70 bg-background/95 py-1 pe-3 ps-1 shadow-sm">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        autoPlay={autoPlay}
        data-contract-audio=""
        onPlay={(event) => {
          setPlaying(true);
          document.querySelectorAll<HTMLAudioElement>("audio[data-contract-audio]").forEach((other) => {
            if (other !== event.currentTarget) other.pause();
          });
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onDurationChange={(event) => setDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
        onError={() => {
          setFailed(true);
          setPlaying(false);
          setBuffering(false);
        }}
      />
      <button
        type="button"
        onClick={() => void toggle()}
        aria-label={playing ? "توقف" : "پخش فایل صوتی"}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-sm transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      >
        {failed ? (
          <AlertTriangle className="h-4 w-4" />
        ) : buffering ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : playing ? (
          <Pause className="h-4 w-4 fill-current" />
        ) : (
          <Play className="h-4 w-4 translate-x-px fill-current" />
        )}
      </button>
      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={Math.min(current, duration || 0)}
        disabled={!duration}
        aria-label="موقعیت پخش"
        onChange={(event) => {
          const el = audioRef.current;
          if (!el) return;
          el.currentTime = Number(event.target.value);
          setCurrent(el.currentTime);
        }}
        className="h-1 min-w-0 flex-1 cursor-pointer accent-brand disabled:cursor-default"
      />
      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
        {failed ? "خطا" : `${formatClock(current)} / ${formatClock(duration)}`}
      </span>
    </div>
  );
}

export function ContractAssetCard({
  asset,
  actions,
  onPreview,
}: {
  asset: ContractAsset;
  actions?: ReactNode;
  onPreview?: (asset: ContractAsset) => void;
}) {
  const href = contractAssetHref(asset);
  const [imageFailed, setImageFailed] = useState(false);
  const media = href ? assetMediaType(asset) : null;
  const showImage = media === "image" && !imageFailed;
  const canPreview = Boolean(onPreview) && (media === "image" || media === "video");
  const openPreview = () => onPreview?.(asset);

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm transition-shadow hover:shadow-md">
      <div className="relative flex h-32 items-center justify-center bg-muted/40 text-muted-foreground">
        {showImage && href ? (
          <button
            type="button"
            onClick={openPreview}
            disabled={!canPreview}
            aria-label={`نمایش ${asset.name}`}
            className="h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand disabled:cursor-default"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={href}
              alt={asset.name}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-contain p-2"
              onError={() => setImageFailed(true)}
            />
          </button>
        ) : media === "video" && href ? (
          <button
            type="button"
            onClick={openPreview}
            disabled={!canPreview}
            aria-label={`پخش ${asset.name}`}
            className="relative h-full w-full overflow-hidden bg-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand disabled:cursor-default"
          >
            <video
              src={`${href}#t=0.5`}
              preload="metadata"
              muted
              playsInline
              className="pointer-events-none h-full w-full object-cover opacity-80"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/35">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-lg transition-transform group-hover:scale-105">
                <Play className="h-5 w-5 translate-x-px fill-current" />
              </span>
            </span>
          </button>
        ) : media === "audio" && href ? (
          <div className="flex w-full flex-col items-center gap-2 px-3">
            <FileAudio className="h-6 w-6 text-brand" />
            <InlineAudioPlayer src={href} />
          </div>
        ) : (
          <KindIcon asset={asset} />
        )}
        {href && canPreview ? (
          <button
            type="button"
            onClick={openPreview}
            className="absolute end-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg bg-background/90 text-foreground opacity-0 shadow-sm transition-opacity hover:text-brand focus-visible:opacity-100 group-hover:opacity-100"
            aria-label="نمایش فایل"
            title="نمایش"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        ) : href && media !== "audio" ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="absolute end-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg bg-background/90 text-foreground opacity-0 shadow-sm transition-opacity hover:text-brand focus-visible:opacity-100 group-hover:opacity-100"
            aria-label="باز کردن فایل"
            title="باز کردن فایل"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <p className="line-clamp-2 break-words text-sm font-semibold leading-6" title={asset.name}>
          {asset.name}
        </p>
        {asset.note ? (
          <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">{asset.note}</p>
        ) : null}
        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 text-[11px] text-muted-foreground">
          {asset.kind === "REFERENCE" ? (
            <span className="truncate" dir="ltr">
              {href}
            </span>
          ) : (
            <span dir="ltr">{formatFileSize(asset.sizeBytes)}</span>
          )}
          {asset.createdAt ? <span>· {formatDate(asset.createdAt)}</span> : null}
        </div>
        {actions ? (
          <div className="flex items-center justify-end gap-1 border-t border-border/60 pt-2">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AssetPreviewDialog({
  asset,
  onClose,
}: {
  asset: ContractAsset | null;
  onClose: () => void;
}) {
  const href = asset ? contractAssetHref(asset) : null;
  const media = asset && href ? assetMediaType(asset) : null;

  return (
    <Dialog
      open={Boolean(asset)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent dir="rtl" className="text-start sm:max-w-3xl">
        <DialogHeader className="text-start sm:text-start">
          <DialogTitle className="line-clamp-2 break-words pe-6">
            {asset?.name || "پیش‌نمایش"}
          </DialogTitle>
        </DialogHeader>
        {href && media === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={href}
            alt={asset?.name || ""}
            className="max-h-[75vh] w-full rounded-xl bg-muted object-contain"
          />
        ) : null}
        {href && media === "video" ? (
          <VideoPlayer
            key={asset?.id}
            src={href}
            title={asset?.name}
            type={asset?.mimeType || undefined}
            autoPlay
            className="rounded-xl"
          />
        ) : null}
        {asset?.note ? (
          <p className="text-sm leading-6 text-muted-foreground">{asset.note}</p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** Assets grouped by kind, in the same order as the upload modal. */
export function ContractAssetsGrid({
  assets,
  renderActions,
}: {
  assets: ContractAsset[];
  renderActions?: (asset: ContractAsset) => ReactNode;
}) {
  const [previewing, setPreviewing] = useState<ContractAsset | null>(null);
  const groups = ASSET_GROUP_ORDER.map((key) => ({
    key,
    items: assets.filter((asset) => assetGroupKey(asset.kind) === key),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.key} className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">{ASSET_KIND_LABELS[group.key]}</h3>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
              {formatCount(group.items.length)}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {group.items.map((asset) => (
              <ContractAssetCard
                key={asset.id}
                asset={asset}
                actions={renderActions?.(asset)}
                onPreview={setPreviewing}
              />
            ))}
          </div>
        </section>
      ))}
      <AssetPreviewDialog asset={previewing} onClose={() => setPreviewing(null)} />
    </div>
  );
}
