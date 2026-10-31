import type { ReactNode } from "react";
import { company } from "../../shared/content.ts";
import type { RoutePath } from "../lib/router.ts";
import { Icon, type IconName } from "./Icon.tsx";
import { ui } from "./ui.ts";

const NAV: { path: RoutePath; label: string; icon: IconName }[] = [
  { path: "/", label: "ฝึกโทร", icon: "phone" },
  { path: "/drill", label: "ข้ออ้าง", icon: "objection" },
  { path: "/scripts", label: "สคริปต์", icon: "doc" },
  { path: "/quiz", label: "ควิซ", icon: "check" },
  { path: "/dashboard", label: "สถิติ", icon: "chart" },
];

export function Layout({ active, children }: { active: RoutePath; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-brand-50">
      <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <a href="#/" className="min-w-0">
            <p className="truncate text-base font-bold text-brand-900 sm:text-lg">TSR Motor Sales Coach</p>
            <p className="truncate text-xs text-ink-muted">{company.name}</p>
          </a>
          <nav className="hidden gap-1 md:flex" aria-label="เมนูหลัก">
            {NAV.map((item) => (
              <a
                key={item.path}
                href={`#${item.path}`}
                aria-current={active === item.path ? "page" : undefined}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
                  active === item.path ? "bg-brand-100 text-brand-700" : "text-ink-muted hover:bg-brand-50 hover:text-brand-700"
                }`}
              >
                <Icon name={item.icon} className="h-4 w-4" />
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pt-4 pb-28 md:pb-10">{children}</main>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="เมนูหลัก"
      >
        <div className="mx-auto grid max-w-md grid-cols-5">
          {NAV.map((item) => (
            <a
              key={item.path}
              href={`#${item.path}`}
              aria-current={active === item.path ? "page" : undefined}
              className={`relative flex flex-col items-center gap-0.5 py-2 text-xs font-medium ${
                active === item.path ? "text-brand-700" : "text-ink-muted"
              }`}
            >
              {active === item.path && <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-gold-500" />}
              <Icon name={item.icon} className="h-6 w-6" />
              {item.label}
            </a>
          ))}
        </div>
      </nav>
    </div>
  );
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h1 className="text-xl font-bold text-brand-900 sm:text-2xl">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`${ui.card} ${className}`}>{children}</section>;
}
