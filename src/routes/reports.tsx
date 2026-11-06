import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Download } from "lucide-react";
import { useMemo } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { FinanceChart } from "@/components/stufin/FinanceChart";
import { Card, PageTitle, PeriodPicker, SectionTitle, usePeriod } from "@/components/stufin/ui";
import { buildSeries, inRange, toCSV } from "@/lib/finance";
import { useFinance, useMoney } from "@/lib/hooks";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports & analytics — STUFIN" },
      { name: "description", content: "Income, expenses, hours, tuition and rent analysed for any date range." },
      { property: "og:title", content: "Reports & analytics — STUFIN" },
      { property: "og:description", content: "Income, expenses, hours, tuition and rent analysed for any date range." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Reports,
});

function Reports() {
  const d = useFinance();
  const money = useMoney();
  const p = usePeriod("this-month");
  const r = useMemo(() => {
    if (!d) return null;
    const sh = d.shifts.filter((s) => inRange(s.date, p.range));
    const ex = d.expenses.filter((e) => inRange(e.date, p.range));
    const income = sh.reduce((a, b) => a + b.earned, 0);
    const spent = ex.reduce((a, b) => a + b.amount, 0);
    const received = d.earnPay.filter((x) => inRange(x.date, p.range)).reduce((a, b) => a + b.amount, 0);
    const tuition = d.tuitionPay.filter((x) => inRange(x.date, p.range)).reduce((a, b) => a + b.amount, 0);
    const rent = d.records.filter((x) => x.refType === "rent" && inRange(x.date, p.range)).reduce((a, b) => a + b.amount, 0);
    const byWp = Object.entries(sh.reduce<Record<string, number>>((m, s) => ((m[s.workplaceName] = (m[s.workplaceName] ?? 0) + s.earned), m), {})).map(([name, v]) => ({ name, v: v / 100 }));
    const byCat = Object.entries(ex.reduce<Record<string, number>>((m, e) => ((m[e.categoryName] = (m[e.categoryName] ?? 0) + e.amount), m), {})).map(([name, v]) => ({ name, v: v / 100 })).sort((a, b) => b.v - a.v);
    return { income, spent, received, tuition, rent, hours: sh.reduce((a, b) => a + b.minutes, 0) / 60, byWp, byCat, sh, ex,
      series: buildSeries(p.range, sh.map((s) => ({ date: s.date, amount: s.earned })), ex) };
  }, [d, p.range.from, p.range.to]);

  const exportCsv = () => {
    if (!r) return;
    const rows = [
      ...r.sh.map((s) => ({ type: "earning", date: s.date, name: s.workplaceName, amount: (s.earned / 100).toFixed(2), hours: (s.minutes / 60).toFixed(2) })),
      ...r.ex.map((e) => ({ type: "expense", date: e.date, name: e.categoryName, amount: (-e.amount / 100).toFixed(2), hours: "" })),
    ].sort((a, b) => a.date.localeCompare(b.date));
    const url = URL.createObjectURL(new Blob([toCSV(rows)], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = `stufin-report-${p.range.from}-to-${p.range.to}.csv`; a.click();
  };

  const net = r ? r.income - r.spent : 0;
  const savings = r && r.income ? Math.round((net / r.income) * 100) : 0;
  const Bars = ({ data, color }: { data: { name: string; v: number }[]; color: string }) => (
    <div style={{ height: Math.max(80, data.length * 40) }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 12 }}>
          <XAxis type="number" hide /><YAxis type="category" dataKey="name" width={96} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
          <Tooltip formatter={(v: number) => money(Math.round(v * 100))} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }} cursor={{ fill: "var(--muted)" }} />
          <Bar dataKey="v" radius={[0, 8, 8, 0]} barSize={18}>{data.map((_, i) => <Cell key={i} fill={color} />)}</Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <>
      <Link to="/" className="mb-2 flex items-center gap-1 text-sm text-muted-foreground"><ChevronLeft className="h-4 w-4" />Home</Link>
      <PageTitle title="Reports" sub="Analytics" action={<Button variant="soft" onClick={exportCsv}><Download />CSV</Button>} />
      <PeriodPicker {...p.picker} />
      <div className="mt-4 grid grid-cols-2 gap-2">
        {[
          ["Earnings", r?.income, "text-income"], ["Expenses", r?.spent, "text-expense"],
          ["Net balance", net, net < 0 ? "text-expense" : "text-income"], ["Pay received", r?.received, ""],
          ["Tuition paid", r?.tuition, ""], ["Rent paid", r?.rent, ""],
        ].map(([l, v, c]) => (
          <Card key={l as string} className="p-3"><p className="text-xs text-muted-foreground">{l}</p><p className={cn("text-lg font-bold tabular-nums", c as string)}>{r ? money(v as number) : "—"}</p></Card>
        ))}
        <Card className="p-3"><p className="text-xs text-muted-foreground">Hours worked</p><p className="text-lg font-bold tabular-nums">{r ? r.hours.toFixed(1) : "—"}</p></Card>
        <Card className="p-3"><p className="text-xs text-muted-foreground">Saved of earnings</p><p className={cn("text-lg font-bold tabular-nums", savings < 0 ? "text-expense" : "text-income")}>{savings}%</p></Card>
      </div>
      <Card className="mt-3"><h2 className="mb-1 font-semibold">Trend</h2>{r && <FinanceChart data={r.series} />}</Card>
      <SectionTitle>Earnings by workplace</SectionTitle>
      <Card>{r?.byWp.length ? <Bars data={r.byWp} color="var(--income)" /> : <p className="text-sm text-muted-foreground">No shifts in this period.</p>}</Card>
      <SectionTitle>Expenses by category</SectionTitle>
      <Card>{r?.byCat.length ? <Bars data={r.byCat} color="var(--expense)" /> : <p className="text-sm text-muted-foreground">No expenses in this period.</p>}</Card>
    </>
  );
}
