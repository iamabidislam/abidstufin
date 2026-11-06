import { addDays, format } from "date-fns";
import { db, TABLES, uid, type TableName } from "./db";
import { iso, shiftEarnings, shiftMinutes, toCSV } from "./finance";

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportJSON() {
  const data: Record<string, unknown[]> = {};
  for (const t of TABLES) data[t] = await db.table(t).toArray();
  download(`stufin-backup-${format(new Date(), "yyyy-MM-dd")}.json`,
    JSON.stringify({ app: "STUFIN", version: 1, exportedAt: new Date().toISOString(), data }, null, 2), "application/json");
  const cur = await db.user_settings.get("me");
  if (cur) await db.user_settings.update("me", { lastBackup: new Date().toISOString() });
}

export async function exportCSV() {
  const [shifts, expenses] = await Promise.all([db.work_shifts.toArray(), db.expenses.toArray()]);
  const rows = [
    ...shifts.map((s) => ({ type: "earning", date: s.date, name: s.workplaceName, category: "Shift", amount: (s.earned / 100).toFixed(2), hours: (s.minutes / 60).toFixed(2), notes: s.notes ?? "" })),
    ...expenses.map((e) => ({ type: "expense", date: e.date, name: e.categoryName, category: e.categoryName, amount: (-e.amount / 100).toFixed(2), hours: "", notes: e.notes ?? "" })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  download(`stufin-transactions-${format(new Date(), "yyyy-MM-dd")}.csv`, toCSV(rows), "text/csv");
}

export type ParsedBackup = { data: Record<TableName, unknown[]>; counts: number };
export function parseBackup(text: string): ParsedBackup {
  let json: unknown;
  try { json = JSON.parse(text); } catch { throw new Error("This file isn't valid JSON."); }
  const j = json as { app?: string; data?: Record<string, unknown> };
  if (j?.app !== "STUFIN" || typeof j.data !== "object" || !j.data) throw new Error("This isn't a STUFIN backup file.");
  let counts = 0;
  const data = {} as Record<TableName, unknown[]>;
  for (const t of TABLES) {
    const rows = j.data[t] ?? [];
    if (!Array.isArray(rows) || rows.some((r) => typeof r !== "object" || !r || !("id" in r)))
      throw new Error(`Backup section "${t}" is damaged.`);
    data[t] = rows; counts += rows.length;
  }
  return { data, counts };
}
export async function restoreBackup(b: ParsedBackup) {
  await db.transaction("rw", TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) { await db.table(t).clear(); await db.table(t).bulkAdd(b.data[t]); }
  });
}

export async function clearDemo() {
  await db.transaction("rw", TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) if (t !== "user_settings") await db.table(t).filter((r) => !!r.demo).delete();
  });
  await db.user_settings.update("me", { demo: false });
}

export async function loadDemo() {
  const d = (n: number) => iso(addDays(new Date(), n));
  const wp = [
    { id: uid(), name: "ABC Restaurant", position: "Part-time staff", rate: 1250, demo: true },
    { id: uid(), name: "Campus Library", position: "Assistant", rate: 1185, demo: true },
  ];
  const shifts = Array.from({ length: 10 }, (_, i) => {
    const w = wp[i % 2]!; const minutes = shiftMinutes("09:00", i % 3 ? "15:00" : "14:00", 30);
    return { id: uid(), workplaceId: w.id, workplaceName: w.name, date: d(-i * 3), start: "09:00", end: i % 3 ? "15:00" : "14:00", breakMin: 30, rate: w.rate, minutes, earned: shiftEarnings(minutes, w.rate), demo: true };
  });
  const cats = [
    { id: uid(), name: "Groceries", icon: "ShoppingCart", color: "emerald", demo: true },
    { id: uid(), name: "Uber", icon: "Car", color: "navy", demo: true },
    { id: uid(), name: "Food", icon: "Utensils", color: "amber", demo: true },
    { id: uid(), name: "Subscriptions", icon: "Tv", color: "red", demo: true },
  ];
  const exps = Array.from({ length: 14 }, (_, i) => {
    const c = cats[i % 4]!;
    return { id: uid(), categoryId: c.id, categoryName: c.name, amount: [2340, 1850, 950, 1099][i % 4]!, date: d(-i * 2), demo: true };
  });
  const tId = uid(); const i1 = uid();
  await db.transaction("rw", TABLES.map((t) => db.table(t)), async () => {
    await db.workplaces.bulkAdd(wp);
    await db.work_shifts.bulkAdd(shifts);
    await db.earnings_payments.bulkAdd(shifts.slice(3).map((s) => ({ id: uid(), shiftId: s.id, amount: s.earned, date: s.date, demo: true })));
    for (const c of cats) if (!(await db.expense_categories.where("name").equalsIgnoreCase(c.name).count())) await db.expense_categories.add(c);
    await db.expenses.bulkAdd(exps);
    await db.tuition_records.add({ id: tId, university: "University of Manchester", course: "MSc Data Science", total: 2400000, discount: 300000, frequency: "termly", demo: true });
    await db.tuition_installments.bulkAdd([
      { id: i1, tuitionId: tId, name: "Instalment 1", amount: 700000, dueDate: d(-40), demo: true },
      { id: uid(), tuitionId: tId, name: "Instalment 2", amount: 700000, dueDate: d(5), demo: true },
      { id: uid(), tuitionId: tId, name: "Instalment 3", amount: 700000, dueDate: d(90), demo: true },
    ]);
    await db.tuition_payments.add({ id: uid(), tuitionId: tId, installmentId: i1, amount: 700000, date: d(-42), demo: true });
    await db.accommodation.add({ id: uid(), name: "Unite Students – Parkway", rent: 72000, frequency: "monthly", nextDate: d(9), demo: true });
    await db.recurring_payments.add({ id: uid(), name: "Internet", amount: 2500, frequency: "monthly", nextDate: d(3), demo: true });
    await db.reminders.add({ id: uid(), name: "Phone bill", type: "Other", amount: 1500, dueDate: d(2), remindDate: d(1), remindTime: "09:00", repeat: "monthly", paid: false, demo: true });
  });
  const cur = await db.user_settings.get("me");
  await db.user_settings.put({ ...(cur ?? { id: "me", firstName: "", currency: "GBP", defaultRate: 0, weekStartsOn: 1, theme: "light", notifications: false }), demo: true });
}
