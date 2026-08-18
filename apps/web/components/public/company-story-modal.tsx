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
        overlayClassName="bg-black/45 backdrop-blur-md backdrop-saturate-150 dark:bg-black/60 supports-[backdrop-filter]:bg-black/30 dark:supports-[backdrop-filter]:bg-black/45"
        className="grid max-h-[min(90dvh,44rem)] w-[calc(100%-1.5rem)] max-w-3xl grid-rows-[auto,minmax(0,1fr),auto] gap-0 overflow-hidden border-border/70 bg-card p-0 text-card-foreground shadow-2xl sm:rounded-2xl"
        aria-describedby="company-story-text"
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <DialogHeader className="space-y-1 border-b border-border/70 px-5 pb-4 pt-5 pe-12 text-center sm:px-8 sm:pt-7 sm:text-center">
          <DialogTitle className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            {COMPANY_STORY_TITLE}
          </DialogTitle>
        </DialogHeader>

        <div
          id="company-story-text"
          className="min-h-0 overflow-y-auto overscroll-contain px-5 py-5 sm:px-8 sm:py-6"
        >
          <div className="mx-auto max-w-2xl space-y-5 text-start">
            {COMPANY_STORY_PARAGRAPHS.map((paragraph) => (
              <p
                key={paragraph.slice(0, 24)}
                className="text-pretty text-[0.95rem] leading-8 text-foreground/90 sm:text-base sm:leading-9"
              >
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        <DialogFooter className="border-t border-border/70 bg-muted/20 px-5 py-4 sm:justify-center sm:px-8">
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
