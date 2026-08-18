"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CompanyStoryModal } from "@/components/public/company-story-modal";
import { COMPANY_INTRO_DESCRIPTION, COMPANY_INTRO_TITLE } from "@/lib/company";

function CompanyIntroTitle() {
  const words = COMPANY_INTRO_TITLE.trim().split(/\s+/);
  const brandWord = words.pop() ?? "";
  return (
    <>
      {words.join(" ")} <span className="text-brand">{brandWord}</span>
    </>
  );
}

export function CompanyIntroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);
  const [storyOpen, setStoryOpen] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.28, rootMargin: "0px 0px -8% 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="about"
      dir="rtl"
      className="relative scroll-mt-20 border-t border-border/40 bg-transparent"
      aria-labelledby="company-intro-heading"
    >
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <span
            className={cn(
              "mb-5 h-px w-12 bg-brand",
              visible ? "animate-public-fade" : "opacity-0",
            )}
            aria-hidden
          />

          <h2
            id="company-intro-heading"
            className={cn(
              "text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl",
              visible ? "animate-public-fade" : "opacity-0",
            )}
            style={{ animationDelay: visible ? "70ms" : undefined }}
          >
            <CompanyIntroTitle />
          </h2>

          <p
            className={cn(
              "mt-5 max-w-xl text-pretty text-sm leading-8 text-muted-foreground sm:text-base sm:leading-9",
              visible ? "animate-public-fade" : "opacity-0",
            )}
            style={{ animationDelay: visible ? "140ms" : undefined }}
          >
            {COMPANY_INTRO_DESCRIPTION}
          </p>

          <div
            className={cn(
              "mt-8",
              visible ? "animate-public-fade" : "opacity-0",
            )}
            style={{ animationDelay: visible ? "220ms" : undefined }}
          >
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
          </div>
        </div>
      </div>

      <CompanyStoryModal
        open={storyOpen}
        onOpenChange={setStoryOpen}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          triggerRef.current?.focus();
        }}
      />
    </section>
  );
}
