import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Unified tab design tokens for Radix Tabs and custom role="tab" controls.
 * Active-state classes are written explicitly so Tailwind JIT picks them up.
 */

export type TabsVariant = "default" | "premium" | "segmented" | "line";

const listStyles: Record<TabsVariant, string> = {
  default: [
    "h-auto gap-1 rounded-xl border border-border/60 p-1",
    "bg-gradient-to-b from-muted/70 to-muted/40",
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] dark:shadow-none",
  ].join(" "),
  premium: [
    "h-auto gap-1.5 rounded-2xl border border-border/60 p-1.5",
    "bg-gradient-to-b from-muted/70 to-muted/40",
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] dark:shadow-none",
    "md:gap-2",
  ].join(" "),
  segmented: "h-auto gap-0.5 rounded-xl border border-border/70 bg-muted/30 p-1",
  line: "h-auto w-full gap-0 rounded-none border-b border-border/70 bg-transparent p-0",
};

export const tabsListVariants = cva(
  "inline-flex items-center justify-center text-muted-foreground",
  {
    variants: {
      variant: listStyles,
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const triggerBase = [
  "group relative inline-flex shrink-0 items-center justify-center gap-1.5",
  "whitespace-nowrap font-medium outline-none",
  "transition-all duration-200 ease-out",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
  "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  "disabled:pointer-events-none disabled:opacity-40",
  "after:pointer-events-none after:absolute after:rounded-full after:bg-brand",
  "after:origin-center after:scale-x-0 after:opacity-0",
  "after:transition-all after:duration-300 after:ease-out",
].join(" ");

const triggerShape: Record<TabsVariant, string> = {
  default: "rounded-lg px-3 py-2 text-sm after:inset-x-2.5 after:-bottom-px after:h-[2.5px]",
  premium:
    "rounded-xl px-4 py-2.5 text-xs font-semibold md:text-[13px] after:inset-x-3 after:-bottom-px after:h-[3px]",
  segmented: "rounded-lg px-3 py-1.5 text-xs after:hidden",
  line: "rounded-none px-3 py-2.5 text-sm sm:px-4 sm:py-3 after:inset-x-2 after:bottom-0 after:h-[2.5px] sm:after:inset-x-3 sm:after:h-[3px]",
};

const triggerInactive: Record<TabsVariant, string> = {
  default: "text-muted-foreground hover:bg-background/75 hover:text-foreground",
  premium:
    "text-muted-foreground hover:bg-background/80 hover:text-foreground hover:shadow-sm",
  segmented: "text-muted-foreground hover:text-foreground",
  line: "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
};

/** Radix Tabs — explicit data-[state=active] utilities for Tailwind JIT */
const triggerActiveRadix: Record<TabsVariant, string> = {
  default: [
    "data-[state=active]:bg-background",
    "data-[state=active]:text-brand",
    "data-[state=active]:font-semibold",
    "data-[state=active]:shadow-sm",
    "data-[state=active]:ring-1",
    "data-[state=active]:ring-brand/20",
    "data-[state=active]:after:scale-x-100",
    "data-[state=active]:after:opacity-100",
  ].join(" "),
  premium: [
    "data-[state=active]:bg-background",
    "data-[state=active]:text-brand",
    "data-[state=active]:font-semibold",
    "data-[state=active]:shadow-md",
    "data-[state=active]:ring-1",
    "data-[state=active]:ring-brand/25",
    "data-[state=active]:after:scale-x-100",
    "data-[state=active]:after:opacity-100",
  ].join(" "),
  segmented: [
    "data-[state=active]:bg-background",
    "data-[state=active]:text-brand",
    "data-[state=active]:font-semibold",
    "data-[state=active]:shadow-sm",
    "data-[state=active]:ring-1",
    "data-[state=active]:ring-brand/15",
  ].join(" "),
  line: [
    "data-[state=active]:bg-brand/5",
    "data-[state=active]:text-brand",
    "data-[state=active]:font-semibold",
    "data-[state=active]:shadow-none",
    "data-[state=active]:after:scale-x-100",
    "data-[state=active]:after:opacity-100",
  ].join(" "),
};

/** Custom role="tab" buttons — direct active utilities */
const triggerActiveCustom: Record<TabsVariant, string> = {
  default: [
    "bg-background text-brand font-semibold shadow-sm ring-1 ring-brand/20",
    "after:scale-x-100 after:opacity-100",
  ].join(" "),
  premium: [
    "bg-background text-brand font-semibold shadow-md ring-1 ring-brand/25",
    "after:scale-x-100 after:opacity-100",
  ].join(" "),
  segmented:
    "bg-background text-brand font-semibold shadow-sm ring-1 ring-brand/15",
  line: [
    "bg-brand/5 text-brand font-semibold shadow-none",
    "after:scale-x-100 after:opacity-100",
  ].join(" "),
};

export const tabsTriggerVariants = cva(triggerBase, {
  variants: {
    variant: {
      default: cn(
        triggerShape.default,
        triggerInactive.default,
        triggerActiveRadix.default,
      ),
      premium: cn(
        triggerShape.premium,
        triggerInactive.premium,
        triggerActiveRadix.premium,
      ),
      segmented: cn(
        triggerShape.segmented,
        triggerInactive.segmented,
        triggerActiveRadix.segmented,
      ),
      line: cn(triggerShape.line, triggerInactive.line, triggerActiveRadix.line),
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export type TabsListVariantProps = VariantProps<typeof tabsListVariants>;
export type TabsTriggerVariantProps = VariantProps<typeof tabsTriggerVariants>;

export function getCustomTabListClass(
  variant: TabsVariant = "default",
  className?: string,
) {
  return cn(tabsListVariants({ variant }), className);
}

export function getCustomTabTriggerClass(
  active: boolean,
  variant: TabsVariant = "default",
  className?: string,
) {
  return cn(
    triggerBase,
    triggerShape[variant],
    active ? triggerActiveCustom[variant] : triggerInactive[variant],
    className,
  );
}

export function tabIconShellClass(active?: boolean) {
  return cn(
    "flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-300",
    "bg-muted/80 text-muted-foreground",
    "group-hover:bg-brand/10 group-hover:text-brand",
    active === undefined
      ? "group-data-[state=active]:bg-brand/15 group-data-[state=active]:text-brand group-data-[state=active]:shadow-sm"
      : active
        ? "bg-brand/15 text-brand shadow-sm"
        : undefined,
  );
}

export const tabsContentClass =
  "mt-3 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 data-[state=active]:animate-fade-slide";

export const sectionTabsListClass = cn(
  tabsListVariants({ variant: "line" }),
  "flex w-full min-w-0 justify-start gap-0 overflow-x-auto overscroll-x-contain",
  "[scrollbar-width:thin] [-ms-overflow-style:none] [scrollbar-width:none]",
  "[&::-webkit-scrollbar]:hidden sm:[scrollbar-width:thin]",
);

export const sectionTabsTriggerClass = cn(
  tabsTriggerVariants({ variant: "line" }),
  "shrink-0 gap-1.5 sm:gap-2",
);
