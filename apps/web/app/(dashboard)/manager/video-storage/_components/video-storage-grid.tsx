"use client";

import { VideoStorageCard } from "./video-storage-card";
import type { VideoStorageItem } from "./types";

export function VideoStorageGrid({
  items,
  showOwner,
  canEdit,
  canDelete,
  canSendPortfolio,
  sendPendingId,
  onPreview,
  onEdit,
  onDelete,
  onSendPortfolio,
}: {
  items: VideoStorageItem[];
  showOwner?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canSendPortfolio?: boolean;
  sendPendingId?: string | null;
  onPreview: (item: VideoStorageItem) => void;
  onEdit: (item: VideoStorageItem) => void;
  onDelete: (item: VideoStorageItem) => void;
  onSendPortfolio: (item: VideoStorageItem) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <VideoStorageCard
          key={item.id}
          item={item}
          showOwner={showOwner}
          canEdit={canEdit}
          canDelete={canDelete}
          canSendPortfolio={canSendPortfolio}
          sendPending={sendPendingId === item.id}
          onPreview={() => onPreview(item)}
          onEdit={() => onEdit(item)}
          onDelete={() => onDelete(item)}
          onSendPortfolio={() => onSendPortfolio(item)}
        />
      ))}
    </div>
  );
}
