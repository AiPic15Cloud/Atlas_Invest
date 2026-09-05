import type { ReactNode } from "react";
import { IconTrendingUp } from "./icons";

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
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#faf7fc] px-4 py-12 dark:bg-[#0b0b12]">
      <div className="mb-6 flex items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 shadow-sm">
          <IconTrendingUp className="h-5 w-5 text-white" />
        </div>
        <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">Atlas Invest</span>
      </div>
      <div className={`w-full ${maxWidth} rounded-2xl bg-white p-7 shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-800`}>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
