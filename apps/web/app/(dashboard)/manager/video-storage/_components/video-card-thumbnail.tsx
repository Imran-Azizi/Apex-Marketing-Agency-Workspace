"use client";

import { useState } from "react";
import { Film } from "lucide-react";
import { videoStorageThumbnailUrl } from "@/lib/media";
import { cn } from "@/lib/utils";
import type { VideoStorageItem } from "./types";

/**
 * Lightweight card poster only — never mounts <video> on the grid
 * (that was loading full streams per card and killed page performance).
 */
export function VideoCardThumbnail({
  item,
  className,
}: {
  item: VideoStorageItem;
  className?: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const preferred =
    (item.thumbnailUrl && /^https?:\/\//i.test(item.thumbnailUrl)
      ? item.thumbnailUrl
      : null) ||
    (item.hasThumbnail ? videoStorageThumbnailUrl(item.id) : null);
  const src = preferred && !imgFailed ? preferred : null;

  return (
    <div className={cn("absolute inset-0 bg-zinc-800", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 via-zinc-700 to-zinc-800">
          <Film className="h-10 w-10 text-white/35" />
        </div>
      )}
    </div>
  );
}
