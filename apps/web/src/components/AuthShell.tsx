import type { ReactNode } from "react";

export function AuthShell({
  title,
  subtitle,
  maxWidth = "max-w-sm",
  children,
}: {
  title: string;
  subtitle?: string;
  maxWidth?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12">
      <div className="mb-6 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-base font-bold text-white">
          B
        </div>
        <span className="text-lg font-bold tracking-tight text-slate-900">Budget Foyer</span>
      </div>
      <div className={`w-full ${maxWidth} rounded-2xl bg-white p-7 shadow-sm ring-1 ring-slate-200/80`}>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
