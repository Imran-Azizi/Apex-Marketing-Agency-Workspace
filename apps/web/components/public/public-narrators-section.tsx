"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mic2 } from "lucide-react";
import { apiGet, storagePublicUrl } from "@/lib/api";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PublicSection } from "@/components/public/public-section";

interface Sample {
  id: string;
  title?: string | null;
  storageKey: string;
  language?: string | null;
  teamProfile: {
    id: string;
    displayName: string;
    languages: string[];
    gender: string | null;
    tone: string | null;
  } | null;
}

const GENDER_LABEL: Record<string, string> = {
  male: "مرد",
  female: "زن",
};

export function PublicNarratorsSection() {
  const [lang, setLang] = useState("all");
  const [gender, setGender] = useState("all");
  const [q, setQ] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-narrator-samples"],
    queryFn: () => apiGet<Sample[]>("/public/narrators/samples"),
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });

  const filtered = useMemo(() => {
    return (data || []).filter((s) => {
      if (lang !== "all") {
        const langs = s.teamProfile?.languages || [];
        if (!langs.includes(lang) && s.language !== lang) return false;
      }
      if (gender !== "all" && s.teamProfile?.gender !== gender) return false;
      if (
        q &&
        !s.teamProfile?.displayName?.toLowerCase().includes(q.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [data, lang, gender, q]);

  return (
    <PublicSection
      id="narrators"
      eyebrow="صدا"
      title="نمونه صدای نریتورها"
      description="پخش نمونه و فیلتر بر اساس زبان و جنس صدا"
      tone="muted"
    >
      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <Input
          placeholder="جستجوی نام"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-11 rounded-xl bg-background"
        />
        <Select value={lang} onValueChange={setLang}>
          <SelectTrigger className="h-11 rounded-xl bg-background">
            <SelectValue placeholder="زبان" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه زبان‌ها</SelectItem>
            <SelectItem value="fa">فارسی</SelectItem>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="ps">پشتو</SelectItem>
          </SelectContent>
        </Select>
        <Select value={gender} onValueChange={setGender}>
          <SelectTrigger className="h-11 rounded-xl bg-background">
            <SelectValue placeholder="جنس صدا" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه</SelectItem>
            <SelectItem value="male">مرد</SelectItem>
            <SelectItem value="female">زن</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      ) : null}

      {error ? <EmptyState title="بارگذاری نمونه‌ها ناموفق بود" /> : null}
      {data && filtered.length === 0 ? (
        <EmptyState title="نمونه‌ای یافت نشد" />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {filtered.map((s) => (
          <article
            key={s.id}
            className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition-all duration-300 hover:border-brand/25 hover:shadow-md"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <Mic2 className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold tracking-tight text-foreground">
                  {s.teamProfile?.displayName || s.title || "نریتور"}
                </h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {s.teamProfile?.tone ? (
                    <Badge variant="outline" className="font-normal">
                      {s.teamProfile.tone}
                    </Badge>
                  ) : null}
                  {s.teamProfile?.gender ? (
                    <Badge variant="secondary" className="font-normal">
                      {GENDER_LABEL[s.teamProfile.gender] ||
                        s.teamProfile.gender}
                    </Badge>
                  ) : null}
                </div>
              </div>
            </div>
            <audio
              className="mt-4 w-full"
              controls
              src={storagePublicUrl(s.storageKey) || undefined}
              preload="none"
            />
          </article>
        ))}
      </div>
    </PublicSection>
  );
}
