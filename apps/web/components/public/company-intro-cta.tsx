"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CompanyStoryModal } from "@/components/public/company-story-modal";

export function CompanyIntroCta() {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [storyOpen, setStoryOpen] = useState(false);

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant="brand"
        size="lg"
        className="h-12 min-h-11 rounded-xl px-7 shadow-sm shadow-brand/20 motion-safe:transition-transform motion-safe:hover:-translate-y-px"
        aria-haspopup="dialog"
        aria-expanded={storyOpen}
        onClick={() => setStoryOpen(true)}
      >
        داستان اپیکس
      </Button>
      <CompanyStoryModal
        open={storyOpen}
        onOpenChange={setStoryOpen}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          triggerRef.current?.focus();
        }}
      />
    </>
  );
}
