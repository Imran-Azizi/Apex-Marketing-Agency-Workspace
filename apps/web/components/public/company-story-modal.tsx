"use client";

import type { ComponentPropsWithoutRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  COMPANY_STORY_PARAGRAPHS,
  COMPANY_STORY_TITLE,
} from "@/lib/company";

type DialogContentProps = ComponentPropsWithoutRef<typeof DialogContent>;

export function CompanyStoryModal({
  open,
  onOpenChange,
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus?: DialogContentProps["onCloseAutoFocus"];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        overlayClassName="bg-black/50 dark:bg-black/60"
        closeClassName="end-2 top-2 h-10 w-10 sm:end-3 sm:top-3 sm:h-8 sm:w-8"
        className="grid max-h-[min(92dvh,40rem)] w-[calc(100%-1rem)] max-w-3xl grid-rows-[auto,minmax(0,1fr),auto] gap-0 overflow-hidden rounded-2xl border-border/70 bg-card p-0 text-card-foreground shadow-2xl duration-150 sm:w-[calc(100%-1.5rem)] sm:max-h-[min(90dvh,44rem)] sm:rounded-2xl"
        aria-describedby="company-story-text"
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <DialogHeader className="shrink-0 space-y-0 border-b border-border/70 px-4 py-3.5 pe-12 text-start sm:px-8 sm:py-5 sm:pe-14 sm:text-start">
          <DialogTitle className="text-lg font-bold tracking-tight text-foreground sm:text-2xl">
            {COMPANY_STORY_TITLE}
          </DialogTitle>
        </DialogHeader>

        <div
          id="company-story-text"
          className="min-h-0 overflow-y-auto overscroll-contain px-4 py-4 [-webkit-overflow-scrolling:touch] sm:px-8 sm:py-6"
        >
          <div className="mx-auto max-w-2xl space-y-4 text-start sm:space-y-5">
            {COMPANY_STORY_PARAGRAPHS.map((paragraph, index) => (
              <p
                key={index}
                className="text-pretty text-sm leading-7 text-foreground/90 sm:text-base sm:leading-9"
              >
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t border-border/70 bg-muted/20 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:justify-center sm:px-8 sm:py-4 sm:pb-4">
          <DialogClose asChild>
            <Button
              type="button"
              variant="brand"
              size="lg"
              className="h-11 w-full rounded-xl px-8 sm:w-auto"
            >
              بستن
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
