"use client";

import { useParams } from "next/navigation";
import { PolicyReaderView } from "../_components/policy-reader-view";

export default function PolicyDetailPage() {
  const params = useParams<{ id: string }>();
  return <PolicyReaderView id={String(params.id)} />;
}
