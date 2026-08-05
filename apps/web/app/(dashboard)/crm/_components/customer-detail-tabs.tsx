"use client";

import type { LucideIcon } from "lucide-react";
import { FileText, History, Send } from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { tabIconShellClass } from "@/components/shared/tab-styles";
import { cn } from "@/lib/utils";

export const CRM_DETAIL_TABS = [
  {
    value: "details",
    label: "جزئیات قرارداد",
    shortLabel: "قرارداد",
    icon: FileText,
    requiresOpp: true,
  },
  {
    value: "history",
    label: "سوابق پرداخت",
    shortLabel: "سوابق",
    icon: History,
    requiresOpp: true,
  },
  {
    value: "portal",
    label: "دعوت پورتال مشتری",
    shortLabel: "پورتال",
    icon: Send,
    requiresOpp: true,
  },
] as const;

export type CrmDetailTabValue = (typeof CRM_DETAIL_TABS)[number]["value"];

interface CustomerDetailTabsNavProps {
  hasOpportunity: boolean;
  className?: string;
}

export function CustomerDetailTabsNav({
  hasOpportunity,
  className,
}: CustomerDetailTabsNavProps) {
  return (
    <div
      dir="rtl"
      className={cn(
        "overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      <TabsList
        variant="premium"
        className="w-max min-w-full items-stretch justify-start md:w-full"
      >
        {CRM_DETAIL_TABS.map((tab) => {
          const Icon = tab.icon as LucideIcon;
          const disabled = tab.requiresOpp && !hasOpportunity;
          return (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              variant="premium"
              disabled={disabled}
              className="md:flex-1"
            >
              <span className={tabIconShellClass()}>
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="hidden whitespace-nowrap sm:inline">
                <span className="lg:hidden">{tab.shortLabel}</span>
                <span className="hidden lg:inline">{tab.label}</span>
              </span>
              <span className="sm:hidden">{tab.shortLabel}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </div>
  );
}
