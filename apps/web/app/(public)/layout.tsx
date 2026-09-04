import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/layout/public-footer";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="public-dot-pattern flex min-h-screen flex-col">
      <PublicHeader />
      <main className="relative flex-1 overflow-x-hidden">{children}</main>
      <PublicFooter />
    </div>
  );
}
