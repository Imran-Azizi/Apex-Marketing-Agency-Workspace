import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CONTACT_SUBJECTS } from "@/lib/contact";
import type { SortValue, StatusFilter, SubjectFilter } from "./types";
import { formatCount } from "./types";

const FILTERS: Array<{ id: StatusFilter; label: string }> = [
  { id: "ALL", label: "همه" },
  { id: "UNREAD", label: "خوانده‌نشده" },
  { id: "READ", label: "خوانده‌شده" },
];

export function ContactMessagesToolbar({
  search,
  onSearchChange,
  status,
  onStatusChange,
  unreadCount,
  subject,
  onSubjectChange,
  sort,
  onSortChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  status: StatusFilter;
  onStatusChange: (value: StatusFilter) => void;
  unreadCount: number;
  subject: SubjectFilter;
  onSubjectChange: (value: SubjectFilter) => void;
  sort: SortValue;
  onSortChange: (value: SortValue) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-sm sm:p-4">
      <div className="relative min-w-0">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="جستجو در نام، ایمیل، شماره، موضوع یا پیام..."
          className="h-11 rounded-xl border-border/80 bg-background ps-9 shadow-sm"
          aria-label="جستجوی پیام‌ها"
        />
      </div>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div
          className="inline-flex w-full overflow-x-auto rounded-xl border border-border/80 bg-muted/40 p-1 lg:w-auto"
          role="tablist"
          aria-label="فیلتر وضعیت پیام"
        >
          {FILTERS.map((item) => {
            const active = status === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onStatusChange(item.id)}
                className={cn(
                  "min-w-0 flex-1 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition-colors lg:flex-none",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
                  active
                    ? "bg-brand text-brand-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-background/80 hover:text-foreground",
                )}
              >
                {item.label}
                {item.id === "UNREAD" && unreadCount > 0 ? (
                  <span
                    className={cn(
                      "ms-1.5 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums",
                      active
                        ? "bg-background/20 text-brand-foreground"
                        : "bg-brand/15 text-brand",
                    )}
                  >
                    {formatCount(unreadCount)}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={subject}
            onValueChange={(value) => onSubjectChange(value as SubjectFilter)}
          >
            <SelectTrigger
              className="h-10 w-full rounded-xl sm:w-[11.5rem]"
              aria-label="فیلتر موضوع"
            >
              <SelectValue placeholder="موضوع" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">همه موضوع‌ها</SelectItem>
              {CONTACT_SUBJECTS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={sort}
            onValueChange={(value) => onSortChange(value as SortValue)}
          >
            <SelectTrigger
              className="h-10 w-full rounded-xl sm:w-[10.5rem]"
              aria-label="مرتب‌سازی"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">جدیدترین</SelectItem>
              <SelectItem value="oldest">قدیمی‌ترین</SelectItem>
              <SelectItem value="name">نام مشتری</SelectItem>
              <SelectItem value="status">وضعیت</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
