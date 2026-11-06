import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { Briefcase, Pencil, Plus, Search, Trash2, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BottomSheet, ReceiveForm, ShiftForm, WorkplaceForm } from "@/components/stufin/forms";
import { Confirm } from "@/components/stufin/confirm";
import { FinanceChart } from "@/components/stufin/FinanceChart";
import { Card, Empty, PageTitle, PeriodPicker, SectionTitle, StatusPill, usePeriod, nativeSelect } from "@/components/stufin/ui";
import { db, type Workplace, type WorkShift } from "@/lib/db";
import { buildSeries, fromMinor, inRange } from "@/lib/finance";
import { useFinance, useMoney } from "@/lib/hooks";

export const Route = createFileRoute("/earnings")({
  validateSearch: (s: Record<string, unknown>) => ({ add: typeof s.add === "string" ? s.add : undefined }),
  head: () => ({
    meta: [
      { title: "Earnings & shifts — STUFIN" },
      { name: "description", content: "Log working hours across workplaces and track estimated vs received pay." },
      { property: "og:title", content: "Earnings & shifts — STUFIN" },
      { property: "og:description", content: "Log working hours across workplaces and track estimated vs received pay." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Earnings,
});

type SheetState = { kind: "workplace"; item?: Workplace } | { kind: "shift"; item?: WorkShift } | { kind: "receive"; item: WorkShift } | null;

function Earnings() {
  const d = useFinance();
  const money = useMoney();
  const p = usePeriod("this-week");
  const { add } = Route.useSearch();
  const nav = useNavigate();
  const [sheet, setSheet] = useState<SheetState>(null);
  const [q, setQ] = useState("");
  const [wpFilter, setWpFilter] = useState("");

  useEffect(() => {
    if (!add || !d) return;
    setSheet(d.workplaces.length ? { kind: "shift" } : { kind: "workplace" });
    nav({ to: "/earnings", search: { add: undefined }, replace: true });
  }, [add, d, nav]);

  const v = useMemo(() => {
    if (!d) return null;
    const received = (id: string) => d.earnPay.filter((x) => x.shiftId === id).reduce((a, b) => a + b.amount, 0);
    const inP = d.shifts.filter((s) => inRange(s.date, p.range));
    const byWp = d.workplaces.map((w) => ({ w, total: inP.filter((s) => s.workplaceId === w.id).reduce((a, b) => a + b.earned, 0), mins: inP.filter((s) => s.workplaceId === w.id).reduce((a, b) => a + b.minutes, 0) }));
    const list = d.shifts
      .filter((s) => (!wpFilter || s.workplaceId === wpFilter) && inRange(s.date, p.range))
      .filter((s) => !q || `${s.workplaceName} ${s.notes ?? ""} ${s.date}`.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => b.date.localeCompare(a.date) || b.start.localeCompare(a.start));
    return {
      received,
      mins: inP.reduce((a, b) => a + b.minutes, 0),
      est: inP.reduce((a, b) => a + b.earned, 0),
      got: d.earnPay.filter((x) => inRange(x.date, p.range)).reduce((a, b) => a + b.amount, 0),
      byWp, list,
      series: buildSeries(p.range, inP.map((s) => ({ date: s.date, amount: s.earned })), []),
    };
  }, [d, p.range.from, p.range.to, q, wpFilter]);

  const delShift = async (s: WorkShift) => {
    await db.transaction("rw", db.work_shifts, db.earnings_payments, async () => {
      await db.earnings_payments.where("shiftId").equals(s.id).delete();
      await db.work_shifts.delete(s.id);
    });
    toast.success("Shift deleted");
  };
  const delWp = async (w: Workplace) => { await db.workplaces.delete(w.id); toast.success("Workplace removed — past shifts are kept"); };

  return (
    <>
      <PageTitle title="Earnings" sub="Shifts & pay" action={<Button onClick={() => setSheet(d?.workplaces.length ? { kind: "shift" } : { kind: "workplace" })}><Plus />Log shift</Button>} />
      <PeriodPicker {...p.picker} />

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Card className="p-3"><p className="text-xs text-muted-foreground">Hours</p><p className="text-lg font-bold tabular-nums">{v ? (v.mins / 60).toFixed(1) : "—"}</p></Card>
        <Card className="p-3"><p className="text-xs text-muted-foreground">Estimated</p><p className="text-lg font-bold tabular-nums text-income">{v ? money(v.est) : "—"}</p></Card>
        <Card className="p-3"><p className="text-xs text-muted-foreground">Received</p><p className="text-lg font-bold tabular-nums">{v ? money(v.got) : "—"}</p></Card>
      </div>

      {v && v.est > 0 && <Card className="mt-3"><h2 className="mb-1 font-semibold">Daily earnings</h2><FinanceChart data={v.series} height={170} /></Card>}

      <SectionTitle action={<Button size="sm" variant="soft" onClick={() => setSheet({ kind: "workplace" })}><Plus />Add</Button>}>Workplaces</SectionTitle>
      <Card className="divide-y divide-border p-0">
        {v?.byWp.length ? v.byWp.map(({ w, total, mins }) => (
          <div key={w.id} className="flex items-center gap-3 px-4 py-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-accent text-accent-foreground"><Briefcase className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{w.name}</p>
              <p className="text-xs text-muted-foreground">{money(w.rate)}/hr · {(mins / 60).toFixed(1)}h this period</p>
            </div>
            <p className="font-semibold tabular-nums">{money(total)}</p>
            <button aria-label="Edit workplace" onClick={() => setSheet({ kind: "workplace", item: w })} className="p-1.5 text-muted-foreground"><Pencil className="h-4 w-4" /></button>
            <Confirm title={`Remove ${w.name}?`} description="Past shifts and their pay stay in your history." action="Remove" onConfirm={() => delWp(w)}
              trigger={<button aria-label="Delete workplace" className="p-1.5 text-muted-foreground"><Trash2 className="h-4 w-4" /></button>} />
          </div>
        )) : <Empty icon={Briefcase} title="No workplaces yet" hint="Add where you work and your hourly rate." />}
      </Card>

      <SectionTitle>Shift history</SectionTitle>
      <div className="mb-3 grid grid-cols-[1fr_auto] gap-2">
        <div className="relative"><Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search shifts" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className={nativeSelect + " w-36"} value={wpFilter} onChange={(e) => setWpFilter(e.target.value)} aria-label="Filter by workplace">
          <option value="">All places</option>{d?.workplaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        {v?.list.length ? v.list.map((s) => {
          const got = v.received(s.id);
          const status = got >= s.earned ? ["paid", "Received"] : got > 0 ? ["partial", "Partially received"] : ["upcoming", "Estimated"];
          return (
            <Card key={s.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{s.workplaceName}</p>
                  <p className="text-xs text-muted-foreground">{format(parseISO(s.date), "EEE d MMM")} · {s.start}–{s.end} · {s.breakMin}m break</p>
                  <p className="text-xs text-muted-foreground">{(s.minutes / 60).toFixed(2)}h × {money(s.rate)}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold tabular-nums text-income">{money(s.earned)}</p>
                  <StatusPill status={status[0]} label={status[1]} />
                </div>
              </div>
              {s.notes && <p className="mt-2 text-sm text-muted-foreground">{s.notes}</p>}
              <div className="mt-3 flex gap-2">
                {got < s.earned && <Button size="sm" variant="income" onClick={() => setSheet({ kind: "receive", item: s })}><Wallet />Mark received</Button>}
                <Button size="sm" variant="soft" onClick={() => setSheet({ kind: "shift", item: s })}><Pencil />Edit</Button>
                <Confirm title="Delete this shift?" description={`${money(s.earned)} on ${s.date} will be removed.`} onConfirm={() => delShift(s)}
                  trigger={<Button size="sm" variant="soft"><Trash2 />Delete</Button>} />
              </div>
            </Card>
          );
        }) : <Card><Empty icon={Briefcase} title="No shifts in this period" /></Card>}
      </div>

      <BottomSheet open={!!sheet} onOpenChange={(o) => !o && setSheet(null)}
        title={sheet?.kind === "workplace" ? (sheet.item ? "Edit workplace" : "Add workplace") : sheet?.kind === "receive" ? "Record pay received" : sheet?.item ? "Edit shift" : "Log working hours"}>
        {sheet?.kind === "workplace" && <WorkplaceForm initial={sheet.item} onDone={() => setSheet(null)} />}
        {sheet?.kind === "shift" && d && <ShiftForm workplaces={d.workplaces} initial={sheet.item} onDone={() => setSheet(null)} />}
        {sheet?.kind === "receive" && v && <ReceiveForm shift={sheet.item} received={v.received(sheet.item.id)} onDone={() => setSheet(null)} />}
      </BottomSheet>
    </>
  );
}
void fromMinor;
