"use client";

import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  getUserInitials,
  resolveProfileImageSrc,
} from "@/lib/profile-image";
import { cn } from "@/lib/utils";

export type UserAvatarProps = {
  name?: string | null;
  profileImage?: string | null;
  profileImageUrl?: string | null;
  /** Local blob URL while uploading / before save. */
  previewUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
  alt?: string;
};

/**
 * Shared staff/user avatar: Bunny CDN (or /files) URL with initials fallback.
 * Never shows a broken-image icon — load errors fall back to initials.
 */
export function UserAvatar({
  name,
  profileImage,
  profileImageUrl,
  previewUrl,
  className,
  fallbackClassName,
  alt,
}: UserAvatarProps) {
  const src = resolveProfileImageSrc({
    profileImage,
    profileImageUrl,
    previewUrl,
  });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  return (
    <Avatar className={cn("shrink-0", className)}>
      {src && !failed ? (
        <AvatarImage
          src={src}
          alt={alt || name || ""}
          className="object-cover"
          onLoadingStatusChange={(status) => {
            if (status === "error") setFailed(true);
          }}
        />
      ) : null}
      <AvatarFallback className={fallbackClassName}>
        {getUserInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
