import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NOINDEX_ROBOTS } from "@/lib/seo";

export const metadata: Metadata = { robots: NOINDEX_ROBOTS };

/** Bookmark-safe: section lives on the home page. */
export default function PortfolioRedirectPage() {
  redirect("/#portfolio");
}
