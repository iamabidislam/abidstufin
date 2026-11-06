import { Link, useLocation } from "@tanstack/react-router";
import {
  Car, Coffee, Gift, GraduationCap, HeartPulse, Home, Landmark, Lightbulb, type LucideIcon,
  Music, Plane, Receipt, Settings, ShoppingBag, ShoppingCart, Smartphone, Train, Tv, Utensils, Wallet, Wifi, Briefcase,
  CalendarClock,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { periodRange, type PeriodKey, type Range } from "@/lib/finance";
import { useSettings, useThemeSync } from "@/lib/hooks";
import { Input } from "@/components/ui/input";

export const ICONS: Record<string, LucideIcon> = {
  ShoppingCart, Car, Utensils, Tv, Home, Wifi, Lightbulb, ShoppingBag, Train, HeartPulse, Coffee, Music, Plane, Gift, Smartphone, Receipt, GraduationCap, Landmark,
};
export const COLORS: Record<string, string> = {
  emerald: "bg-income-soft text-income",
  red: "bg-expense-soft text-expense",
  navy: "bg-muted text-primary",
  amber: "bg-warning-soft text-warning",
};

const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/earnings", label: "Earnings", icon: Briefcase },
  { to: "/expenses", label: "Expenses", icon: Wallet },
  { to: "/payments", label: "Payments", icon: CalendarClock },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  useThemeSync();
  const { pathname } = useLocation();
  return (
    <div className="mx-auto min-h-screen max-w-md bg-background pt-safe">
      <main className="px-5 pb-32 pt-4">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/90 backdrop-blur-xl pb-safe">
        <div className="mx-auto grid max-w-md grid-cols-5">
          {NAV.map((n) => {
            const active = n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
            const I = n.icon;
            return (
              <Link key={n.to} to={n.to} className={cn("flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors", active ? "text-secondary" : "text-muted-foreground")}>
                <span className={cn("grid h-8 w-12 place-items-center rounded-full transition-colors", active && "bg-accent")}>
                  <I className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} />
                </span>
                {n.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export function PageTitle({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <header className="mb-5 flex items-end justify-between gap-3">
      <div>
        {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      </div>
      {action}
    </header>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("card-surface p-4", className)}>{children}</section>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between">
      <h2 className="text-lg font-semibold">{children}</h2>
      {action}
    </div>
  );
}

export function Empty({ icon: I = Receipt, title, hint }: { icon?: LucideIcon; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center py-8 text-center">
      <span className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground"><I className="h-5 w-5" /></span>
      <p className="font-medium">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="flex rounded-full bg-muted p-1">
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={cn("flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition-all", value === o.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

const PERIODS: { value: PeriodKey; label: string }[] = [
  { value: "this-week", label: "This week" }, { value: "last-week", label: "Last week" },
  { value: "this-month", label: "This month" }, { value: "last-month", label: "Last month" },
  { value: "this-year", label: "This year" }, { value: "custom", label: "Custom" },
];
export function PeriodPicker({ value, onChange, custom, onCustom, compact }: {
  value: PeriodKey; onChange: (v: PeriodKey) => void; custom: Range; onCustom: (r: Range) => void; compact?: boolean;
}) {
  const list = compact ? PERIODS.filter((p) => ["this-week", "this-month", "custom"].includes(p.value)) : PERIODS;
  return (
    <div className="space-y-2">
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
        {list.map((p) => (
          <button key={p.value} type="button" onClick={() => onChange(p.value)}
            className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              value === p.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground")}>
            {p.label}
          </button>
        ))}
      </div>
      {value === "custom" && (
        <div className="grid grid-cols-2 gap-2">
          <Input type="date" value={custom.from} max={custom.to} onChange={(e) => onCustom({ ...custom, from: e.target.value })} aria-label="From" />
          <Input type="date" value={custom.to} min={custom.from} onChange={(e) => onCustom({ ...custom, to: e.target.value })} aria-label="To" />
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
export function usePeriod(initial: PeriodKey = "this-month") {
  const { weekStartsOn } = useSettings();
  const [key, setKey] = useState<PeriodKey>(initial);
  const [custom, setCustom] = useState<Range>(() => periodRange("this-month"));
  const range = periodRange(key, weekStartsOn, new Date(), custom);
  return { key, setKey, custom, setCustom, range, picker: { value: key, onChange: setKey, custom, onCustom: setCustom } };
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function StatusPill({ status, label }: { status: string; label: string }) {
  const cls = status === "paid" ? "bg-income-soft text-income" : status === "overdue" ? "bg-expense-soft text-expense"
    : status === "due-soon" || status === "partial" ? "bg-warning-soft text-warning" : "bg-muted text-muted-foreground";
  return <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", cls)}>{label}</span>;
}

export const nativeSelect = "h-11 w-full rounded-xl border border-input bg-card px-3 text-base";
