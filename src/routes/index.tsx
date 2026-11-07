import { createFileRoute, Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { ArrowDownRight, ArrowUpRight, Bell, Briefcase, CalendarPlus, Clock, Receipt, BarChart3 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { FinanceChart } from "@/components/stufin/FinanceChart";
import { Card, Empty, PeriodPicker, SectionTitle, StatusPill, usePeriod, ICONS } from "@/components/stufin/ui";
import { buildSeries, inRange, STATUS_LABEL } from "@/lib/finance";
import { useFinance, useMoney, useSettings } from "@/lib/hooks";
import { upcoming } from "@/lib/upcoming";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "STUFIN — Your money at a glance" },
      { name: "description", content: "See your earnings, expenses and net balance in one private dashboard." },
      { property: "og:title", content: "STUFIN — Your money at a glance" },
      { property: "og:description", content: "See your earnings, expenses and net balance in one private dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function greeting(now: Date) {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function Home() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const refresh = () => setNow(new Date());
    refresh();
    const interval = window.setInterval(refresh, 1000);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  const d = useFinance();
  const s = useSettings();
  const money = useMoney();
  const p = usePeriod("this-month");

  const stats = useMemo(() => {
    if (!d) return null;
    const inc = d.shifts.filter((x) => inRange(x.date, p.range)).map((x) => ({ date: x.date, amount: x.earned }));
    const exp = d.expenses.filter((x) => inRange(x.date, p.range));
    const earn = inc.reduce((a, b) => a + b.amount, 0);
    const spent = exp.reduce((a, b) => a + b.amount, 0);
    const recent = [
      ...d.shifts.map((x) => ({ id: x.id, name: x.workplaceName, cat: `${(x.minutes / 60).toFixed(1)}h shift`, date: x.date, amount: x.earned, income: true, icon: "Briefcase" })),
      ...d.expenses.map((x) => ({ id: x.id, name: x.categoryName, cat: x.notes || x.method || "Expense", date: x.date, amount: x.amount, income: false, icon: d.categories.find((c) => c.id === x.categoryId)?.icon ?? "Receipt" })),
    ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
    return { earn, spent, net: earn - spent, series: buildSeries(p.range, inc, exp), recent, due: upcoming(d).filter((x) => x.status !== "paid").slice(0, 4) };
  }, [d, p.range.from, p.range.to]);

  return (
    <>
      <header className="mb-5 flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{now ? format(now, "EEEE d MMMM") : "\u00a0"}</p>
          <h1 className="text-2xl font-bold tracking-tight">{now ? greeting(now) : "Hello"}{s.firstName && `, ${s.firstName}`}</h1>
        </div>
        <Link to="/payments" aria-label="Payment reminders" className="relative grid h-11 w-11 place-items-center rounded-full bg-card shadow-sm">
          <Bell className="h-5 w-5" />
          {!!stats?.due.some((x) => x.status === "overdue" || x.status === "due-soon") && <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-expense" />}
        </Link>
      </header>
      {s.demo && <p className="mb-3 rounded-xl bg-warning-soft px-3 py-2 text-xs font-medium text-warning">Demo mode — sample data is shown. Clear it in Settings.</p>}

      <section className="rounded-3xl bg-hero p-5 text-hero-foreground">
        <p className="text-sm opacity-70">Net balance</p>
        <p className={cn("mt-1 text-4xl font-bold tabular-nums tracking-tight", stats && stats.net < 0 && "text-expense")}>{stats ? money(stats.net) : "—"}</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-hero-foreground/10 p-3">
            <p className="flex items-center gap-1 text-xs opacity-70"><ArrowUpRight className="h-3.5 w-3.5 text-income" />Earnings</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">{stats ? money(stats.earn) : "—"}</p>
          </div>
          <div className="rounded-2xl bg-hero-foreground/10 p-3">
            <p className="flex items-center gap-1 text-xs opacity-70"><ArrowDownRight className="h-3.5 w-3.5 text-expense" />Expenses</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">{stats ? money(stats.spent) : "—"}</p>
          </div>
        </div>
      </section>

      <div className="mt-4"><PeriodPicker {...p.picker} compact /></div>

      <Card className="mt-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Income vs expenses</h2>
          <Link to="/reports" className="flex items-center gap-1 text-sm font-medium text-secondary"><BarChart3 className="h-4 w-4" />Reports</Link>
        </div>
        {stats ? <FinanceChart data={stats.series} /> : <div className="h-[240px] animate-pulse rounded-2xl bg-muted" />}
      </Card>

      <div className="mt-4 grid grid-cols-4 gap-2">
        {[
          { to: "/earnings", search: { add: "shift" }, label: "Earnings", icon: Briefcase },
          { to: "/expenses", search: { add: "expense" }, label: "Expense", icon: Receipt },
          { to: "/earnings", search: { add: "hours" }, label: "Hours", icon: Clock },
          { to: "/payments", search: { add: "reminder" }, label: "Payment", icon: CalendarPlus },
        ].map((q) => (
          <Link key={q.label} to={q.to} search={q.search as never} className="card-surface flex flex-col items-center gap-1.5 py-3 text-xs font-medium">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-accent text-accent-foreground"><q.icon className="h-5 w-5" /></span>
            Add {q.label}
          </Link>
        ))}
      </div>

      <SectionTitle action={<Link to="/payments" className="text-sm font-medium text-secondary">See all</Link>}>Upcoming payments</SectionTitle>
      <Card className="divide-y divide-border p-0">
        {stats?.due.length ? stats.due.map((x) => (
          <div key={x.key} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{x.name}</p>
              <p className="text-xs text-muted-foreground">Due {format(parseISO(x.dueDate), "d MMM")}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold tabular-nums">{money(x.amount - x.paid)}</p>
              <StatusPill status={x.status} label={STATUS_LABEL[x.status]} />
            </div>
          </div>
        )) : <Empty icon={CalendarPlus} title="Nothing due" hint="Add tuition, rent or bills in Payments." />}
      </Card>

      <SectionTitle>Recent activity</SectionTitle>
      <Card className="divide-y divide-border p-0">
        {stats?.recent.length ? stats.recent.map((r) => {
          const I = r.income ? Briefcase : ICONS[r.icon] ?? Receipt;
          return (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3">
              <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full", r.income ? "bg-income-soft text-income" : "bg-expense-soft text-expense")}><I className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.name}</p>
                <p className="truncate text-xs text-muted-foreground">{r.cat} · {format(parseISO(r.date), "d MMM")}</p>
              </div>
              <p className={cn("font-semibold tabular-nums", r.income ? "text-income" : "text-expense")}>{r.income ? "+" : "−"}{money(r.amount)}</p>
            </div>
          );
        }) : <Empty title="No activity yet" hint="Log a shift or an expense to get started." />}
      </Card>
    </>
  );
}
