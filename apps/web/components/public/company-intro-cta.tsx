"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

const loadCompanyStoryModal = () =>
  import("@/components/public/company-story-modal");

const CompanyStoryModal = dynamic(
  () =>
    loadCompanyStoryModal().then((m) => ({
      default: m.CompanyStoryModal,
    })),
  { ssr: false },
);

export function CompanyIntroCta() {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [storyOpen, setStoryOpen] = useState(false);
  const [modalReady, setModalReady] = useState(false);

  const ensureModal = useCallback(() => {
    if (!modalReady) setModalReady(true);
    void loadCompanyStoryModal();
  }, [modalReady]);

  const openStory = useCallback(async () => {
    setModalReady(true);
    await loadCompanyStoryModal();
    setStoryOpen(true);
  }, []);

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
        onPointerEnter={ensureModal}
        onFocus={ensureModal}
        onClick={() => {
          void openStory();
        }}
      >
        داستان اپیکس
      </Button>
      {modalReady ? (
        <CompanyStoryModal
          open={storyOpen}
          onOpenChange={setStoryOpen}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            triggerRef.current?.focus();
          }}
        />
      ) : null}
    </>
  );
}
