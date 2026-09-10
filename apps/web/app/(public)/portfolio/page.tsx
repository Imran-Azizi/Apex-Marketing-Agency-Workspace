import { redirect } from "next/navigation";

/** Bookmark-safe: section lives on the home page. */
export default function PortfolioRedirectPage() {
  redirect("/#portfolio");
}
