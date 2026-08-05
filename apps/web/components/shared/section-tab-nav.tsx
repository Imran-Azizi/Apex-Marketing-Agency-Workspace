"use client";

import type { ReactNode } from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { sectionTabsListClass, sectionTabsTriggerClass } from "@/components/shared/tab-styles";
import { cn } from "@/lib/utils";

export function SectionTabs({
  value,
  onValueChange,
  dir = "rtl",
  className,
  children,
}: {
  value: string;
  onValueChange: (value: string) => void;
  dir?: "rtl" | "ltr";
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tabs
      value={value}
      onValueChange={onValueChange}
      dir={dir}
      className={cn("min-w-0", className)}
    >
      {children}
    </Tabs>
  );
}

export function SectionTabsList({
  className,
  children,
  "aria-label": ariaLabel,
}: {
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
}) {
  return (
    <TabsList
      variant="line"
      aria-label={ariaLabel}
      className={cn(sectionTabsListClass, className)}
    >
      {children}
    </TabsList>
  );
}

export function SectionTabsTrigger({
  value,
  className,
  children,
}: {
  value: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <TabsTrigger
      value={value}
      variant="line"
      className={cn(sectionTabsTriggerClass, className)}
    >
      {children}
    </TabsTrigger>
  );
}

export function SectionTabsPanel({
  value,
  className,
  children,
}: {
  value: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <TabsContent value={value} className={cn("mt-4", className)}>
      {children}
    </TabsContent>
  );
}
