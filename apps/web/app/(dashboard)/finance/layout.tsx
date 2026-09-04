import { FinanceSubnav } from "./_components/finance-subnav";

export default function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-0">
      <FinanceSubnav />
      {children}
    </div>
  );
}
