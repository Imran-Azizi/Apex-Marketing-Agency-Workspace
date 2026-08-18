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
  PortfolioAdminCategory,
  PortfolioMixedFilter,
  PortfolioStatusFilter,
} from "./types";

export function PortfolioToolbar({
  search,
  onSearchChange,
  status,
  onStatusChange,
  categoryId,
  onCategoryChange,
  mixed,
  onMixedChange,
  categories,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  status: PortfolioStatusFilter;
  onStatusChange: (value: PortfolioStatusFilter) => void;
  categoryId: string;
  onCategoryChange: (value: string) => void;
  mixed: PortfolioMixedFilter;
  onMixedChange: (value: PortfolioMixedFilter) => void;
  categories: PortfolioAdminCategory[];
}) {
  return (
    <div
      className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 text-start lg:flex-row lg:items-center"
      dir="rtl"
    >
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="جستجو بر اساس عنوان…"
          className="h-11 rounded-xl border-border/80 bg-background ps-9 shadow-sm"
          aria-label="جستجوی نمونه‌کارها"
        />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:w-auto">
        <Select
          value={status}
          onValueChange={(v) => onStatusChange(v as PortfolioStatusFilter)}
        >
          <SelectTrigger className="h-11 w-full rounded-xl sm:w-40" dir="rtl">
            <SelectValue placeholder="وضعیت" />
          </SelectTrigger>
          <SelectContent dir="rtl">
            <SelectItem value="ALL">همه وضعیت‌ها</SelectItem>
            <SelectItem value="PUBLISHED">فعال</SelectItem>
            <SelectItem value="UNPUBLISHED">غیرفعال</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryId} onValueChange={onCategoryChange}>
          <SelectTrigger className="h-11 w-full rounded-xl sm:w-48" dir="rtl">
            <SelectValue placeholder="کتگوری" />
          </SelectTrigger>
          <SelectContent dir="rtl">
            <SelectItem value="ALL">همه کتگوری‌ها</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={mixed}
          onValueChange={(v) => onMixedChange(v as PortfolioMixedFilter)}
        >
          <SelectTrigger className="h-11 w-full rounded-xl sm:w-44" dir="rtl">
            <SelectValue placeholder="مختلط" />
          </SelectTrigger>
          <SelectContent dir="rtl">
            <SelectItem value="ALL">همه (مختلط)</SelectItem>
            <SelectItem value="IN">در مختلط</SelectItem>
            <SelectItem value="OUT">خارج از مختلط</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
