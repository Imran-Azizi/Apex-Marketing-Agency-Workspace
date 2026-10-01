"use client";

import { useCallback, useRef, useState } from "react";
import type { LandingContent } from "@/lib/landing-content";
import { cloneBlock } from "@/lib/landing-content";

const MAX_HISTORY = 50;

export function useLandingHistory(initial: LandingContent) {
  const presentRef = useRef(initial);
  const [content, setContentState] = useState(initial);
  const pastRef = useRef<LandingContent[]>([]);
  const futureRef = useRef<LandingContent[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const syncFlags = useCallback(() => {
    setCanUndo(pastRef.current.length > 0);
    setCanRedo(futureRef.current.length > 0);
  }, []);

  const setContent = useCallback(
    (next: LandingContent, { record = true } = {}) => {
      if (record) {
        pastRef.current = [
          ...pastRef.current.slice(-(MAX_HISTORY - 1)),
          cloneBlock(presentRef.current),
        ];
        futureRef.current = [];
      }
      presentRef.current = next;
      setContentState(next);
      syncFlags();
    },
    [syncFlags],
  );

  const undo = useCallback(() => {
    const prev = pastRef.current.pop();
    if (!prev) return;
    futureRef.current.push(cloneBlock(presentRef.current));
    presentRef.current = prev;
    setContentState(prev);
    syncFlags();
  }, [syncFlags]);

  const redo = useCallback(() => {
    const next = futureRef.current.pop();
    if (!next) return;
    pastRef.current.push(cloneBlock(presentRef.current));
    presentRef.current = next;
    setContentState(next);
    syncFlags();
  }, [syncFlags]);

  const reset = useCallback(
    (next: LandingContent) => {
      pastRef.current = [];
      futureRef.current = [];
      presentRef.current = next;
      setContentState(next);
      syncFlags();
    },
    [syncFlags],
  );

  return {
    content,
    setContent,
    undo,
    redo,
    canUndo,
    canRedo,
    reset,
  };
}
