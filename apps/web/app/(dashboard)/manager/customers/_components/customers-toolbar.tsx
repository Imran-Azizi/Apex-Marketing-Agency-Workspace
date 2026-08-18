import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CustomerStatusFilter } from "./types";

export function CustomersToolbar({
  search,
  onSearchChange,
  status,
  onStatusChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  status: CustomerStatusFilter;
  onStatusChange: (value: CustomerStatusFilter) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 sm:flex-row sm:items-center">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="جستجو در نام مشتری، شرکت یا توضیحات…"
          className="ps-9"
          aria-label="جستجوی مشتریان"
        />
      </div>
      <Select
        value={status}
        onValueChange={(v) => onStatusChange(v as CustomerStatusFilter)}
      >
        <SelectTrigger className="w-full sm:w-44" dir="rtl">
          <SelectValue placeholder="وضعیت" />
        </SelectTrigger>
        <SelectContent dir="rtl">
          <SelectItem value="ALL">همه وضعیت‌ها</SelectItem>
          <SelectItem value="active">فعال</SelectItem>
          <SelectItem value="inactive">غیرفعال</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
