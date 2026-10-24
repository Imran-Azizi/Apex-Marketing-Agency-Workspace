"use client";

import { useParams } from "next/navigation";
import { KnowledgeDetailView } from "../_components/knowledge-detail-view";

export default function KnowledgeDetailPage() {
  const params = useParams<{ id: string }>();
  return (
    <KnowledgeDetailView
      id={String(params.id)}
      expectedKind="EXPERIENCE"
      listHref="/knowledge"
      listLabel="دانش"
    />
  );
}
