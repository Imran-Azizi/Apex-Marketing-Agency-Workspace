"use client";

import { use } from "react";
import { NarratorWorkspace } from "@/components/narrator/narrator-workspace";

export default function NarratorTaskPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  return (
    <div className="min-w-0 py-2 sm:py-4">
      <NarratorWorkspace projectId={projectId} />
    </div>
  );
}
