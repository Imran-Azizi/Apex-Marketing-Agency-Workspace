"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  PortfolioFilter,
  PublishedFilter,
  VideoUploaderOption,
} from "./types";

export function VideoStorageToolbar({
  searchInput,
  onSearchChange,
  portfolio,
  onPortfolioChange,
  published,
  onPublishedChange,
  uploaderId,
  onUploaderChange,
  uploaders,
  showUploaderFilter,
}: {
  searchInput: string;
  onSearchChange: (value: string) => void;
  portfolio: PortfolioFilter;
  onPortfolioChange: (value: PortfolioFilter) => void;
  published: PublishedFilter;
  onPublishedChange: (value: PublishedFilter) => void;
  uploaderId: string;
  onUploaderChange: (value: string) => void;
  uploaders: VideoUploaderOption[];
  showUploaderFilter?: boolean;
}) {
  return (
    <div
      dir="rtl"
      className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-sm sm:p-4"
    >
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchInput}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="جستجو بر اساس عنوان، فایل یا آپلودکننده…"
          className="h-10 rounded-xl pe-3 ps-9"
        />
      </div>
      <div
        className={`grid grid-cols-1 gap-2 sm:grid-cols-2 ${
          showUploaderFilter ? "lg:grid-cols-3" : "lg:grid-cols-2"
        }`}
      >
        <Select
          value={portfolio}
          onValueChange={(v) => onPortfolioChange(v as PortfolioFilter)}
        >
          <SelectTrigger className="h-10 rounded-xl">
            <SelectValue placeholder="نمونه‌کار" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">همه از نظر نمونه‌کار</SelectItem>
            <SelectItem value="IN">اضافه شده به نمونه‌کار</SelectItem>
            <SelectItem value="OUT">هنوز در نمونه‌کار نیست</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={published}
          onValueChange={(v) => onPublishedChange(v as PublishedFilter)}
        >
          <SelectTrigger className="h-10 rounded-xl">
            <SelectValue placeholder="انتشار عمومی" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">همه از نظر انتشار</SelectItem>
            <SelectItem value="YES">منتشر شده</SelectItem>
            <SelectItem value="NO">منتشر نشده</SelectItem>
          </SelectContent>
        </Select>

        {showUploaderFilter ? (
          <Select value={uploaderId} onValueChange={onUploaderChange}>
            <SelectTrigger className="h-10 rounded-xl">
              <SelectValue placeholder="آپلودکننده" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">همه آپلودکننده‌ها</SelectItem>
              {uploaders.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>
    </div>
  );
}
