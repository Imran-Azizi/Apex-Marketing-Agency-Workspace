import type { ShowcaseCustomer } from "@/lib/customers";
import { CustomerCarousel } from "./customer-carousel";

/** Public customers use a carousel; this wrapper keeps existing imports valid. */
export function CustomerGrid({
  customers,
  className,
}: {
  customers: ShowcaseCustomer[];
  className?: string;
}) {
  return <CustomerCarousel customers={customers} className={className} />;
}
