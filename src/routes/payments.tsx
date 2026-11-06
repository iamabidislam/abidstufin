import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { addMonths, addWeeks, addYears, format, parseISO } from "date-fns";
import { Building2, CalendarClock, Check, GraduationCap, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AccommodationForm, BottomSheet, InstallmentForm, RecurringForm, ReminderForm, TuitionForm, TuitionPayForm,
} from "@/components/stufin/forms";
import { Confirm } from "@/components/stufin/confirm";
import { Card, Empty, PageTitle, Segmented, SectionTitle, StatusPill } from "@/components/stufin/ui";
import { db, uid, type Accommodation, type RecurringPayment, type Reminder, type TuitionRecord } from "@/lib/db";
import { dueStatus, iso, nextDue, STATUS_LABEL, today } from "@/lib/finance";
import { useFinance, useMoney } from "@/lib/hooks";
import { upcoming, type DueItem } from "@/lib/upcoming";

export const Route = createFileRoute("/payments")({
  validateSearch: (s: Record<string, unknown>) => ({ add: typeof s.add === "string" ? s.add : undefined }),
  head: () => ({
    meta: [
      { title: "Payments, tuition & rent — STUFIN" },
      { name: "description", content: "Track tuition instalments, rent, bills and payment reminders." },
      { property: "og:title", content: "Payments, tuition & rent — STUFIN" },
      { property: "og:description", content: "Track tuition instalments, rent, bills and payment reminders." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Payments,
});

type Tab = "due" | "tuition" | "home";
type S =
  | { kind: "reminder"; item?: Reminder } | { kind: "tuition"; item?: TuitionRecord } | { kind: "inst"; tuitionId: string }
  | { kind: "tpay"; tuitionId: string; installmentId: string; remaining: number }
  | { kind: "accom"; item?: Accommodation } | { kind: "bill"; item?: RecurringPayment } | null;

function Payments() {
  const d = useFinance();
  const money = useMoney();
  const [tab, setTab] = useState<Tab>("due");
  const [sheet, setSheet] = useState<S>(null);
  const { add } = Route.useSearch();
  const nav = useNavigate();
  useEffect(() => {
    if (!add) return;
    setSheet({ kind: "reminder" });
    nav({ to: "/payments", search: { add: undefined }, replace: true });
  }, [add, nav]);

  const items = useMemo(() => (d ? upcoming(d) : []), [d]);
  const groups = useMemo(() => {
    const t = today();
    const open = items.filter((x) => x.status !== "paid");
    return [
      { title: "Overdue", list: open.filter((x) => x.status === "overdue") },
      { title: "Due today", list: open.filter((x) => x.dueDate === t) },
      { title: "Due soon", list: open.filter((x) => x.status === "due-soon" && x.dueDate !== t) },
      { title: "Upcoming", list: open.filter((x) => x.status === "upcoming" || (x.status === "partial" && x.dueDate !== t)) },
    ];
  }, [items]);

  const markPaid = async (x: DueItem) => {
    if (!d) return;
    if (x.kind === "tuition") {
      const inst = d.installments.find((i) => i.id === x.refId)!;
      return setSheet({ kind: "tpay", tuitionId: inst.tuitionId, installmentId: inst.id, remaining: x.amount - x.paid });
    }
    if (x.kind === "rent" || x.kind === "bill") {
      const rec = x.kind === "rent" ? d.accom.find((a) => a.id === x.refId)! : d.recurring.find((a) => a.id === x.refId)!;
      await db.transaction("rw", db.payment_records, db.accommodation, db.recurring_payments, async () => {
        await db.payment_records.add({ id: uid(), refType: x.kind === "rent" ? "rent" : "recurring", refId: x.refId, name: x.name, amount: x.amount, dueDate: x.dueDate, date: today() });
        const next = nextDue(rec.nextDate, rec.frequency, rec.customDays);
        if (x.kind === "rent") await db.accommodation.update(x.refId, { nextDate: next });
        else await db.recurring_payments.update(x.refId, { nextDate: next });
      });
      return toast.success(`Marked paid · next due ${format(parseISO(nextDue(rec.nextDate, rec.frequency, rec.customDays)), "d MMM")}`);
    }
    const r = d.reminders.find((a) => a.id === x.refId)!;
    await db.payment_records.add({ id: uid(), refType: "reminder", refId: r.id, name: r.name, amount: r.amount, dueDate: r.dueDate, date: today() });
    if (r.repeat === "none") await db.reminders.update(r.id, { paid: true });
    else {
      const step = (s: string) => iso(r.repeat === "weekly" ? addWeeks(parseISO(s), 1) : r.repeat === "monthly" ? addMonths(parseISO(s), 1) : addYears(parseISO(s), 1));
      await db.reminders.update(r.id, { dueDate: step(r.dueDate), remindDate: step(r.remindDate) });
    }
    toast.success("Marked as paid");
  };

  const Row = ({ x }: { x: DueItem }) => (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{x.name}</p>
        <p className="text-xs text-muted-foreground">Due {format(parseISO(x.dueDate), "EEE d MMM")}</p>
      </div>
      <div className="text-right">
        <p className="font-semibold tabular-nums">{money(x.amount - x.paid)}</p>
        <StatusPill status={x.status} label={STATUS_LABEL[x.status]} />
      </div>
      <Confirm title={`Mark "${x.name}" as paid?`} action="Mark paid" onConfirm={() => markPaid(x)}
        trigger={<button aria-label="Mark paid" className="grid h-9 w-9 place-items-center rounded-full bg-income-soft text-income"><Check className="h-4 w-4" /></button>} />
    </div>
  );

  return (
    <>
      <PageTitle title="Payments" sub="Tuition, rent & bills" action={<Button onClick={() => setSheet({ kind: "reminder" })}><Plus />Reminder</Button>} />
      <Segmented value={tab} onChange={setTab} options={[{ value: "due", label: "Due" }, { value: "tuition", label: "Tuition" }, { value: "home", label: "Rent & bills" }]} />

      {tab === "due" && (
        <>
          {groups.every((g) => !g.list.length) && <Card className="mt-4"><Empty icon={CalendarClock} title="You're all clear" hint="Nothing is due. Add a reminder, tuition or rent." /></Card>}
          {groups.filter((g) => g.list.length).map((g) => (
            <div key={g.title}>
              <SectionTitle>{g.title}</SectionTitle>
              <Card className="divide-y divide-border p-0">{g.list.map((x) => <Row key={x.key} x={x} />)}</Card>
            </div>
          ))}
          {!!d?.reminders.length && (
            <>
              <SectionTitle>Your reminders</SectionTitle>
              <Card className="divide-y divide-border p-0">
                {d.reminders.map((r) => (
                  <div key={r.id} className="flex items-center justify-between px-4 py-2.5">
                    <div><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground">Remind {format(parseISO(r.remindDate), "d MMM")} at {r.remindTime} · {r.repeat === "none" ? "once" : r.repeat}{r.paid && " · paid"}</p></div>
                    <div className="flex">
                      <button aria-label="Edit" className="p-1.5 text-muted-foreground" onClick={() => setSheet({ kind: "reminder", item: r })}><Pencil className="h-4 w-4" /></button>
                      <Confirm title="Delete reminder?" onConfirm={() => db.reminders.delete(r.id)} trigger={<button aria-label="Delete" className="p-1.5 text-muted-foreground"><Trash2 className="h-4 w-4" /></button>} />
                    </div>
                  </div>
                ))}
              </Card>
            </>
          )}
        </>
      )}

      {tab === "tuition" && d && (
        <>
          <div className="mt-4 flex justify-end"><Button variant="soft" size="sm" onClick={() => setSheet({ kind: "tuition" })}><Plus />Add tuition</Button></div>
          {!d.tuition.length && <Card className="mt-3"><Empty icon={GraduationCap} title="No tuition added" hint="Add your university fee and instalments." /></Card>}
          {d.tuition.map((t) => {
            const net = t.total - t.discount;
            const paid = d.tuitionPay.filter((p) => p.tuitionId === t.id).reduce((a, b) => a + b.amount, 0);
            const insts = d.installments.filter((i) => i.tuitionId === t.id).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
            const instPaid = (id: string) => d.tuitionPay.filter((p) => p.installmentId === id).reduce((a, b) => a + b.amount, 0);
            const next = insts.find((i) => instPaid(i.id) < i.amount);
            const pct = net ? Math.min(100, Math.round((paid / net) * 100)) : 0;
            return (
              <Card key={t.id} className="mt-3">
                <div className="flex items-start justify-between">
                  <div><p className="text-lg font-semibold">{t.university}</p>{t.course && <p className="text-sm text-muted-foreground">{t.course}</p>}</div>
                  <div className="flex">
                    <button aria-label="Edit" className="p-1.5 text-muted-foreground" onClick={() => setSheet({ kind: "tuition", item: t })}><Pencil className="h-4 w-4" /></button>
                    <Confirm title="Delete this tuition record?" description="Its instalments and payments will be deleted too." onConfirm={async () => {
                      await db.transaction("rw", db.tuition_records, db.tuition_installments, db.tuition_payments, async () => {
                        await db.tuition_payments.where("tuitionId").equals(t.id).delete();
                        await db.tuition_installments.where("tuitionId").equals(t.id).delete();
                        await db.tuition_records.delete(t.id);
                      });
                    }} trigger={<button aria-label="Delete" className="p-1.5 text-muted-foreground"><Trash2 className="h-4 w-4" /></button>} />
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-y-3 text-sm">
                  <div><p className="text-muted-foreground">Original fee</p><p className="font-semibold tabular-nums">{money(t.total)}</p></div>
                  <div><p className="text-muted-foreground">Scholarship</p><p className="font-semibold tabular-nums text-income">−{money(t.discount)}</p></div>
                  <div><p className="text-muted-foreground">Paid</p><p className="font-semibold tabular-nums">{money(paid)}</p></div>
                  <div><p className="text-muted-foreground">Remaining</p><p className="text-lg font-bold tabular-nums text-expense">{money(Math.max(0, net - paid))}</p></div>
                </div>
                <div className="mt-4"><div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>{pct}% paid</span>{next && <span>Next: {next.name} · {format(parseISO(next.dueDate), "d MMM")}</span>}</div><Progress value={pct} className="h-2.5 bg-muted [&>div]:bg-income" /></div>
                <div className="mt-4 divide-y divide-border rounded-2xl bg-muted/50">
                  {insts.map((i) => {
                    const ip = instPaid(i.id); const st = dueStatus(i.dueDate, i.amount, ip);
                    return (
                      <div key={i.id} className="flex items-center gap-2 px-3 py-2.5">
                        <div className="min-w-0 flex-1"><p className="text-sm font-medium">{i.name}</p><p className="text-xs text-muted-foreground">{format(parseISO(i.dueDate), "d MMM yyyy")} · paid {money(ip)} of {money(i.amount)}</p></div>
                        <StatusPill status={st} label={STATUS_LABEL[st]} />
                        {st !== "paid" ? <Button size="sm" variant="income" onClick={() => setSheet({ kind: "tpay", tuitionId: t.id, installmentId: i.id, remaining: i.amount - ip })}>Pay</Button>
                          : <Confirm title="Delete this instalment?" onConfirm={async () => { await db.tuition_payments.where("installmentId").equals(i.id).delete(); await db.tuition_installments.delete(i.id); }}
                              trigger={<button aria-label="Delete" className="p-1 text-muted-foreground"><Trash2 className="h-4 w-4" /></button>} />}
                      </div>
                    );
                  })}
                  <button className="flex w-full items-center justify-center gap-1 py-2.5 text-sm font-medium text-secondary" onClick={() => setSheet({ kind: "inst", tuitionId: t.id })}><Plus className="h-4 w-4" />Add instalment</button>
                </div>
              </Card>
            );
          })}
        </>
      )}

      {tab === "home" && d && (
        <>
          <SectionTitle action={<Button size="sm" variant="soft" onClick={() => setSheet({ kind: "accom" })}><Plus />Add</Button>}>Accommodation</SectionTitle>
          {!d.accom.length && <Card><Empty icon={Building2} title="No accommodation added" /></Card>}
          {d.accom.map((a) => {
            const paid = d.records.filter((r) => r.refId === a.id).reduce((s, r) => s + r.amount, 0);
            const st = dueStatus(a.nextDate, a.rent, 0);
            return (
              <Card key={a.id} className="mb-3">
                <div className="flex justify-between">
                  <div><p className="font-semibold">{a.name}</p>{a.address && <p className="text-sm text-muted-foreground">{a.address}</p>}</div>
                  <div className="flex">
                    <button aria-label="Edit" className="p-1.5 text-muted-foreground" onClick={() => setSheet({ kind: "accom", item: a })}><Pencil className="h-4 w-4" /></button>
                    <Confirm title="Remove this accommodation?" onConfirm={() => db.accommodation.delete(a.id)} trigger={<button aria-label="Delete" className="p-1.5 text-muted-foreground"><Trash2 className="h-4 w-4" /></button>} />
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <div><p className="text-muted-foreground">Rent</p><p className="font-semibold tabular-nums">{money(a.rent)}<span className="text-xs text-muted-foreground">/{a.frequency === "weekly" ? "wk" : a.frequency === "monthly" ? "mo" : `${a.customDays}d`}</span></p></div>
                  <div><p className="text-muted-foreground">Next due</p><p className="font-semibold">{format(parseISO(a.nextDate), "d MMM")}</p></div>
                  <div><p className="text-muted-foreground">Total paid</p><p className="font-semibold tabular-nums">{money(paid)}</p></div>
                </div>
                <div className="mt-3 flex items-center justify-between"><StatusPill status={st} label={STATUS_LABEL[st]} />
                  <Confirm title="Mark this rent as paid?" action="Mark paid" onConfirm={() => markPaid({ key: a.id, kind: "rent", refId: a.id, name: `Rent · ${a.name}`, amount: a.rent, paid: 0, dueDate: a.nextDate, status: st })}
                    trigger={<Button size="sm" variant="income"><Check />Mark paid</Button>} />
                </div>
              </Card>
            );
          })}
          <SectionTitle action={<Button size="sm" variant="soft" onClick={() => setSheet({ kind: "bill" })}><Plus />Add</Button>}>Recurring bills</SectionTitle>
          <Card className="divide-y divide-border p-0">
            {d.recurring.length ? d.recurring.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-4 py-3">
                <button className="text-left" onClick={() => setSheet({ kind: "bill", item: r })}><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{money(r.amount)} / {r.frequency === "weekly" ? "week" : "month"} · next {format(parseISO(r.nextDate), "d MMM")}</p></button>
                <Confirm title={`Delete ${r.name}?`} onConfirm={() => db.recurring_payments.delete(r.id)} trigger={<button aria-label="Delete" className="p-1.5 text-muted-foreground"><Trash2 className="h-4 w-4" /></button>} />
              </div>
            )) : <Empty title="No bills yet" hint="Electricity, internet, council tax, subscriptions…" />}
          </Card>
        </>
      )}

      <BottomSheet open={!!sheet} onOpenChange={(o) => !o && setSheet(null)}
        title={{ reminder: "Payment reminder", tuition: "Tuition", inst: "Add instalment", tpay: "Record tuition payment", accom: "Accommodation", bill: "Recurring bill" }[sheet?.kind ?? "reminder"]}>
        {sheet?.kind === "reminder" && <ReminderForm initial={sheet.item} onDone={() => setSheet(null)} />}
        {sheet?.kind === "tuition" && <TuitionForm initial={sheet.item} onDone={() => setSheet(null)} />}
        {sheet?.kind === "inst" && <InstallmentForm tuitionId={sheet.tuitionId} onDone={() => setSheet(null)} />}
        {sheet?.kind === "tpay" && <TuitionPayForm {...sheet} onDone={() => setSheet(null)} />}
        {sheet?.kind === "accom" && <AccommodationForm initial={sheet.item} onDone={() => setSheet(null)} />}
        {sheet?.kind === "bill" && <RecurringForm initial={sheet.item} onDone={() => setSheet(null)} />}
      </BottomSheet>
    </>
  );
}
