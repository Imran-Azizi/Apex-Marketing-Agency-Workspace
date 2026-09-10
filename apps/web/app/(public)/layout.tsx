import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/layout/public-footer";
import { WhatsAppFloatingButton } from "@/components/public/whatsapp-floating-button";
import { fetchPublicJson } from "@/lib/public-api";
import type { PublicService } from "@/lib/services";
import type { PublicContactInfo } from "@/lib/contact";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [services, contact] = await Promise.all([
    fetchPublicJson<PublicService[]>("/public/services", 60),
    fetchPublicJson<PublicContactInfo>("/public/contact-info", 30),
  ]);

  return (
    <div className="public-dot-pattern flex min-h-screen flex-col">
      <PublicHeader />
      <main className="relative flex-1 overflow-x-hidden">{children}</main>
      <PublicFooter initialServices={services} initialContact={contact} />
      <WhatsAppFloatingButton href={contact?.whatsapp?.href} />
    </div>
  );
}
