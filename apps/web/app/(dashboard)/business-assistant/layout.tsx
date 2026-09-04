import { BusinessAssistantSubnav } from "./_components/subnav";

export default function BusinessAssistantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <BusinessAssistantSubnav />
      {children}
    </div>
  );
}
