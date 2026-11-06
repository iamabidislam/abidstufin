import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Plus, Receipt } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  db, uid, type Accommodation, type Expense, type ExpenseCategory, type Reminder, type RecurringPayment,
  type TuitionRecord, type Workplace, type WorkShift,
} from "@/lib/db";
import { fromMinor, shiftEarnings, shiftMinutes, toMinor, today, formatMoney } from "@/lib/finance";
import { useSettings } from "@/lib/hooks";
import { COLORS, Field, ICONS, nativeSelect } from "./ui";

export function BottomSheet({ open, onOpenChange, title, description, children }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; children: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-h-[92vh] max-w-md overflow-y-auto rounded-t-3xl border-0 px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
        <SheetHeader className="px-0 text-left">
          <SheetTitle className="text-xl">{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="mt-2">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

const money = (v: string, name: string, allowZero = false) => {
  const m = toMinor(v);
  if (Number.isNaN(m) || (!allowZero && m <= 0)) { toast.error(`Enter a valid ${name}.`); return null; }
  return m;
};
async function attempt(fn: () => Promise<unknown>, ok: string, done: () => void) {
  try { await fn(); toast.success(ok); done(); } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't save. Please try again."); }
}

/* ---------------- Workplace ---------------- */
export function WorkplaceForm({ initial, onDone }: { initial?: Workplace; onDone: () => void }) {
  const s = useSettings();
  const [f, setF] = useState({
    name: initial?.name ?? "", position: initial?.position ?? "",
    rate: initial ? fromMinor(initial.rate) : s.defaultRate ? fromMinor(s.defaultRate) : "",
    frequency: initial?.frequency ?? "", startDate: initial?.startDate ?? "", notes: initial?.notes ?? "",
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) { toast.error("Enter a workplace name."); return; }
    const rate = money(f.rate, "hourly rate"); if (rate === null) return;
    attempt(async () => {
      const rec: Workplace = { id: initial?.id ?? uid(), ...f, name: f.name.trim(), rate };
      await db.workplaces.put(rec);
      if (initial && initial.name !== rec.name) await db.work_shifts.where("workplaceId").equals(rec.id).modify({ workplaceName: rec.name });
    }, initial ? "Workplace updated" : "Workplace added", onDone);
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Workplace name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="ABC Restaurant" autoFocus /></Field>
      <Field label="Job position (optional)"><Input value={f.position} onChange={(e) => setF({ ...f, position: e.target.value })} placeholder="Part-time staff" /></Field>
      <Field label="Hourly pay rate" hint="Changing this later won't change past shifts."><Input inputMode="decimal" value={f.rate} onChange={(e) => setF({ ...f, rate: e.target.value })} placeholder="12.50" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Pay frequency">
          <select className={nativeSelect} value={f.frequency} onChange={(e) => setF({ ...f, frequency: e.target.value })}>
            <option value="">—</option><option>Weekly</option><option>Fortnightly</option><option>Monthly</option>
          </select>
        </Field>
        <Field label="Start date"><Input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></Field>
      </div>
      <Field label="Notes (optional)"><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      <Button type="submit" size="lg" className="w-full">Save workplace</Button>
    </form>
  );
}

/* ---------------- Shift ---------------- */
export function ShiftForm({ workplaces, initial, onDone }: { workplaces: Workplace[]; initial?: WorkShift; onDone: () => void }) {
  const { currency } = useSettings();
  const first = workplaces[0];
  const [f, setF] = useState({
    workplaceId: initial?.workplaceId ?? first?.id ?? "", date: initial?.date ?? today(),
    start: initial?.start ?? "09:00", end: initial?.end ?? "17:00", breakMin: String(initial?.breakMin ?? 30),
    rate: initial ? fromMinor(initial.rate) : first ? fromMinor(first.rate) : "", notes: initial?.notes ?? "",
  });
  const minutes = shiftMinutes(f.start, f.end, Number(f.breakMin) || 0);
  const rate = toMinor(f.rate);
  const earned = Number.isNaN(rate) ? 0 : shiftEarnings(minutes, rate);
  const overnight = f.end <= f.start;

  if (!workplaces.length) return <p className="py-6 text-center text-muted-foreground">Add a workplace first, then log your shifts.</p>;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const wp = workplaces.find((w) => w.id === f.workplaceId) ?? (initial ? { id: initial.workplaceId, name: initial.workplaceName } : undefined);
    if (!wp) { toast.error("Choose a workplace."); return; }
    const r = money(f.rate, "hourly rate"); if (r === null) return;
    if (minutes <= 0) { toast.error("Break is longer than the shift."); return; }
    attempt(() => db.work_shifts.put({
      id: initial?.id ?? uid(), workplaceId: wp.id, workplaceName: wp.name, date: f.date, start: f.start, end: f.end,
      breakMin: Number(f.breakMin) || 0, rate: r, minutes, earned: shiftEarnings(minutes, r), notes: f.notes,
    }), initial ? "Shift updated" : "Shift saved", onDone);
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Workplace">
        <select className={nativeSelect} value={f.workplaceId} onChange={(e) => {
          const w = workplaces.find((x) => x.id === e.target.value);
          setF({ ...f, workplaceId: e.target.value, rate: w ? fromMinor(w.rate) : f.rate });
        }}>
          {workplaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </Field>
      <Field label="Work date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start"><Input type="time" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></Field>
        <Field label="End"><Input type="time" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></Field>
        <Field label="Break (minutes)"><Input inputMode="numeric" value={f.breakMin} onChange={(e) => setF({ ...f, breakMin: e.target.value.replace(/\D/g, "") })} /></Field>
        <Field label="Hourly rate"><Input inputMode="decimal" value={f.rate} onChange={(e) => setF({ ...f, rate: e.target.value })} /></Field>
      </div>
      <div className="flex items-center justify-between rounded-2xl bg-accent p-4 text-accent-foreground">
        <div>
          <p className="text-sm">{(minutes / 60).toFixed(2).replace(/\.?0+$/, "")} hours{overnight && " · overnight"}</p>
          <p className="text-2xl font-bold tabular-nums">{formatMoney(earned, currency)}</p>
        </div>
        <span className="text-xs">Estimated</span>
      </div>
      <Field label="Notes (optional)"><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      <Button type="submit" size="lg" className="w-full">Save shift</Button>
    </form>
  );
}

export function ReceiveForm({ shift, received, onDone }: { shift: WorkShift; received: number; onDone: () => void }) {
  const { currency } = useSettings();
  const [amt, setAmt] = useState(fromMinor(Math.max(0, shift.earned - received)));
  const [date, setDate] = useState(today());
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const m = money(amt, "amount"); if (m === null) return;
    attempt(() => db.earnings_payments.add({ id: uid(), shiftId: shift.id, amount: m, date }), "Payment recorded", onDone);
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-muted-foreground">Estimated {formatMoney(shift.earned, currency)} · received so far {formatMoney(received, currency)}</p>
      <Field label="Amount received"><Input inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} autoFocus /></Field>
      <Field label="Date received"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <Button type="submit" size="lg" variant="income" className="w-full">Record payment</Button>
    </form>
  );
}

/* ---------------- Categories & Expenses ---------------- */
export function CategoryForm({ initial, existing, onDone }: { initial?: ExpenseCategory; existing: ExpenseCategory[]; onDone: (c: ExpenseCategory) => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "ShoppingCart");
  const [color, setColor] = useState(initial?.color ?? "emerald");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) { toast.error("Enter a category name."); return; }
    if (existing.some((c) => c.id !== initial?.id && c.name.toLowerCase() === n.toLowerCase())) { toast.error(`"${n}" already exists.`); return; }
    const rec = { id: initial?.id ?? uid(), name: n, icon, color };
    attempt(async () => {
      await db.expense_categories.put(rec);
      if (initial && initial.name !== n) await db.expenses.where("categoryId").equals(rec.id).modify({ categoryName: n });
    }, initial ? "Category updated" : "Category saved", () => onDone(rec));
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Category name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Groceries" autoFocus /></Field>
      <Field label="Icon">
        <div className="grid grid-cols-6 gap-2">
          {Object.entries(ICONS).map(([k, I]) => (
            <button type="button" key={k} onClick={() => setIcon(k)} aria-label={k}
              className={cn("grid aspect-square place-items-center rounded-xl", COLORS[color], icon === k ? "ring-2 ring-ring" : "opacity-70")}>
              <I className="h-5 w-5" />
            </button>
          ))}
        </div>
      </Field>
      <Field label="Colour">
        <div className="flex gap-2">
          {Object.entries(COLORS).map(([k, cls]) => (
            <button type="button" key={k} onClick={() => setColor(k)} aria-label={k} className={cn("h-10 flex-1 rounded-xl", cls, color === k && "ring-2 ring-ring")} />
          ))}
        </div>
      </Field>
      <Button type="submit" size="lg" className="w-full">Save category</Button>
    </form>
  );
}

export function ExpenseForm({ categories, initial, presetCategory, onDone }: {
  categories: ExpenseCategory[]; initial?: Expense; presetCategory?: string; onDone: () => void;
}) {
  const [catId, setCatId] = useState(initial?.categoryId ?? presetCategory ?? categories[0]?.id ?? "");
  const [amt, setAmt] = useState(initial ? fromMinor(initial.amount) : "");
  const [date, setDate] = useState(initial?.date ?? today());
  const [method, setMethod] = useState(initial?.method ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [newCat, setNewCat] = useState(false);
  if (newCat || !categories.length)
    return <CategoryForm existing={categories} onDone={(c) => { setCatId(c.id); setNewCat(false); }} />;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const c = categories.find((x) => x.id === catId); if (!c) { toast.error("Choose a category."); return; }
    const m = money(amt, "amount"); if (m === null) return;
    attempt(() => db.expenses.put({ id: initial?.id ?? uid(), categoryId: c.id, categoryName: c.name, amount: m, date, method, notes }),
      initial ? "Expense updated" : "Expense saved", onDone);
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => {
          const I = ICONS[c.icon] ?? Receipt;
          return (
            <button type="button" key={c.id} onClick={() => setCatId(c.id)}
              className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium", catId === c.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}>
              <I className="h-4 w-4" />{c.name}
            </button>
          );
        })}
        <button type="button" onClick={() => setNewCat(true)} className="flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground"><Plus className="h-4 w-4" />New</button>
      </div>
      <Input inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="0.00" autoFocus aria-label="Amount"
        className="h-16 text-center text-3xl font-bold tabular-nums" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Paid with">
          <select className={nativeSelect} value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="">—</option><option>Card</option><option>Cash</option><option>Bank transfer</option><option>Apple Pay</option>
          </select>
        </Field>
      </div>
      <Field label="Notes (optional)"><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      <Button type="submit" size="lg" className="w-full">Save expense</Button>
    </form>
  );
}

/* ---------------- Tuition ---------------- */
export function TuitionForm({ initial, onDone }: { initial?: TuitionRecord; onDone: () => void }) {
  const [f, setF] = useState({
    university: initial?.university ?? "", course: initial?.course ?? "", total: initial ? fromMinor(initial.total) : "",
    discount: initial ? fromMinor(initial.discount) : "0", frequency: initial?.frequency ?? "termly", deadline: initial?.deadline ?? "",
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!f.university.trim()) { toast.error("Enter the university name."); return; }
    const total = money(f.total, "tuition fee"); if (total === null) return;
    const discount = money(f.discount || "0", "discount", true); if (discount === null) return;
    if (discount > total) { toast.error("Discount can't exceed the fee."); return; }
    attempt(() => db.tuition_records.put({ id: initial?.id ?? uid(), ...f, total, discount }), "Tuition saved", onDone);
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="University"><Input value={f.university} onChange={(e) => setF({ ...f, university: e.target.value })} autoFocus /></Field>
      <Field label="Course (optional)"><Input value={f.course} onChange={(e) => setF({ ...f, course: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Total fee"><Input inputMode="decimal" value={f.total} onChange={(e) => setF({ ...f, total: e.target.value })} /></Field>
        <Field label="Scholarship / discount"><Input inputMode="decimal" value={f.discount} onChange={(e) => setF({ ...f, discount: e.target.value })} /></Field>
        <Field label="Payment frequency">
          <select className={nativeSelect} value={f.frequency} onChange={(e) => setF({ ...f, frequency: e.target.value })}>
            <option value="termly">Termly</option><option value="monthly">Monthly</option><option value="yearly">Once a year</option><option value="custom">Custom</option>
          </select>
        </Field>
        <Field label="Final deadline"><Input type="date" value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} /></Field>
      </div>
      <Button type="submit" size="lg" className="w-full">Save tuition</Button>
    </form>
  );
}

export function InstallmentForm({ tuitionId, onDone }: { tuitionId: string; onDone: () => void }) {
  const [name, setName] = useState(""); const [amt, setAmt] = useState(""); const [due, setDue] = useState(today());
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const m = money(amt, "amount"); if (m === null) return;
    attempt(() => db.tuition_installments.add({ id: uid(), tuitionId, name: name.trim() || "Instalment", amount: m, dueDate: due }), "Instalment added", onDone);
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Instalment 1" autoFocus /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount due"><Input inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} /></Field>
        <Field label="Due date"><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
      </div>
      <Button type="submit" size="lg" className="w-full">Add instalment</Button>
    </form>
  );
}

export function TuitionPayForm({ tuitionId, installmentId, remaining, onDone }: { tuitionId: string; installmentId: string; remaining: number; onDone: () => void }) {
  const [amt, setAmt] = useState(fromMinor(remaining)); const [date, setDate] = useState(today());
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const m = money(amt, "amount"); if (m === null) return;
    if (m > remaining) { toast.error("That's more than what's left on this instalment."); return; }
    attempt(async () => {
      const dup = await db.tuition_payments.where("installmentId").equals(installmentId).filter((p) => p.amount === m && p.date === date).count();
      if (dup) throw new Error("This payment is already recorded.");
      await db.tuition_payments.add({ id: uid(), tuitionId, installmentId, amount: m, date });
    }, "Payment recorded", onDone);
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount paid"><Input inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} autoFocus /></Field>
        <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
      <Button type="submit" size="lg" variant="income" className="w-full">Record payment</Button>
    </form>
  );
}

/* ---------------- Rent & recurring ---------------- */
export function AccommodationForm({ initial, onDone }: { initial?: Accommodation; onDone: () => void }) {
  const [f, setF] = useState({
    name: initial?.name ?? "", address: initial?.address ?? "", rent: initial ? fromMinor(initial.rent) : "",
    frequency: initial?.frequency ?? "monthly", customDays: String(initial?.customDays ?? 28), nextDate: initial?.nextDate ?? today(),
    method: initial?.method ?? "", notes: initial?.notes ?? "",
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) { toast.error("Enter the accommodation name."); return; }
    const rent = money(f.rent, "rent"); if (rent === null) return;
    attempt(() => db.accommodation.put({ id: initial?.id ?? uid(), ...f, rent, customDays: Number(f.customDays) || 28 }), "Accommodation saved", onDone);
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Accommodation name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus /></Field>
      <Field label="Address (optional)"><Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Rent amount"><Input inputMode="decimal" value={f.rent} onChange={(e) => setF({ ...f, rent: e.target.value })} /></Field>
        <Field label="Paid every">
          <select className={nativeSelect} value={f.frequency} onChange={(e) => setF({ ...f, frequency: e.target.value as Accommodation["frequency"] })}>
            <option value="weekly">Week</option><option value="monthly">Month</option><option value="custom">Custom days</option>
          </select>
        </Field>
        {f.frequency === "custom" && <Field label="Every N days"><Input inputMode="numeric" value={f.customDays} onChange={(e) => setF({ ...f, customDays: e.target.value })} /></Field>}
        <Field label="Next payment"><Input type="date" value={f.nextDate} onChange={(e) => setF({ ...f, nextDate: e.target.value })} /></Field>
      </div>
      <Field label="Payment method (optional)"><Input value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })} /></Field>
      <Field label="Notes"><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      <Button type="submit" size="lg" className="w-full">Save</Button>
    </form>
  );
}

export function RecurringForm({ initial, onDone }: { initial?: RecurringPayment; onDone: () => void }) {
  const [f, setF] = useState({ name: initial?.name ?? "", amount: initial ? fromMinor(initial.amount) : "", frequency: initial?.frequency ?? "monthly", nextDate: initial?.nextDate ?? today() });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) { toast.error("Enter a name."); return; }
    const amount = money(f.amount, "amount"); if (amount === null) return;
    attempt(() => db.recurring_payments.put({ id: initial?.id ?? uid(), ...f, amount }), "Bill saved", onDone);
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Bill name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Electricity" autoFocus /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount"><Input inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
        <Field label="Every">
          <select className={nativeSelect} value={f.frequency} onChange={(e) => setF({ ...f, frequency: e.target.value as RecurringPayment["frequency"] })}>
            <option value="weekly">Week</option><option value="monthly">Month</option>
          </select>
        </Field>
      </div>
      <Field label="Next payment"><Input type="date" value={f.nextDate} onChange={(e) => setF({ ...f, nextDate: e.target.value })} /></Field>
      <Button type="submit" size="lg" className="w-full">Save bill</Button>
    </form>
  );
}

export function ReminderForm({ initial, onDone }: { initial?: Reminder; onDone: () => void }) {
  const [f, setF] = useState({
    name: initial?.name ?? "", type: initial?.type ?? "Other", amount: initial ? fromMinor(initial.amount) : "",
    dueDate: initial?.dueDate ?? today(), remindDate: initial?.remindDate ?? today(), remindTime: initial?.remindTime ?? "09:00",
    repeat: initial?.repeat ?? "none",
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) { toast.error("Enter a payment name."); return; }
    const amount = money(f.amount || "0", "amount", true); if (amount === null) return;
    attempt(() => db.reminders.put({ id: initial?.id ?? uid(), ...f, amount, paid: initial?.paid ?? false }), "Reminder saved", onDone);
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Payment name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <select className={nativeSelect} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
            {["Tuition", "Rent", "Electricity", "Internet", "Other"].map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Amount"><Input inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
        <Field label="Due date"><Input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} /></Field>
        <Field label="Repeat">
          <select className={nativeSelect} value={f.repeat} onChange={(e) => setF({ ...f, repeat: e.target.value as Reminder["repeat"] })}>
            <option value="none">Never</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option>
          </select>
        </Field>
        <Field label="Remind me on"><Input type="date" value={f.remindDate} onChange={(e) => setF({ ...f, remindDate: e.target.value })} /></Field>
        <Field label="At"><Input type="time" value={f.remindTime} onChange={(e) => setF({ ...f, remindTime: e.target.value })} /></Field>
      </div>
      <Button type="submit" size="lg" className="w-full">Save reminder</Button>
    </form>
  );
}
