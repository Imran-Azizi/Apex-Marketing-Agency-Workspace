import type { ReactNode } from "react";

export function PanelHeader({
  icon,
  title,
  status,
  actions,
}: {
  icon: ReactNode;
  title: string;
  status?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand/20 bg-brand/10 text-brand">
          {icon}
        </span>
        <div className="min-w-0 space-y-1">
          <h2 className="text-base font-bold tracking-tight sm:text-lg">{title}</h2>
          {status}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div> : null}
    </div>
  );
}
