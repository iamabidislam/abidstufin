import {
  addDays, addMonths, addWeeks, endOfMonth, endOfWeek, endOfYear, format, parseISO,
  startOfMonth, startOfWeek, startOfYear, subMonths, subWeeks, differenceInCalendarDays,
} from "date-fns";

/** Parse "12.50" -> 1250 pence. Returns NaN for invalid input. */
export function toMinor(input: string | number): number {
  const s = String(input).replace(/[,£$€\s]/g, "");
  if (!/^\d*(\.\d{0,2})?$/.test(s) || s === "" || s === ".") return NaN;
  const [w, f = ""] = s.split(".");
  return Number(w || 0) * 100 + Number((f + "00").slice(0, 2));
}
export const fromMinor = (m: number) => (m / 100).toFixed(2);

export function formatMoney(minor: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(minor / 100);
}

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
/** Worked minutes; supports shifts that cross midnight. */
export function shiftMinutes(start: string, end: string, breakMin: number) {
  let diff = toMin(end) - toMin(start);
  if (diff <= 0) diff += 24 * 60;
  return Math.max(0, diff - (breakMin || 0));
}
/** Earnings in pence, rounded to nearest penny. */
export const shiftEarnings = (minutes: number, ratePence: number) => Math.round((minutes * ratePence) / 60);

export type PeriodKey = "this-week" | "last-week" | "this-month" | "last-month" | "this-year" | "custom";
export interface Range { from: string; to: string }
export const iso = (d: Date) => format(d, "yyyy-MM-dd");
export const today = () => iso(new Date());

export function periodRange(key: PeriodKey, weekStartsOn: 0 | 1 = 1, now = new Date(), custom?: Range): Range {
  const o = { weekStartsOn };
  switch (key) {
    case "this-week": return { from: iso(startOfWeek(now, o)), to: iso(endOfWeek(now, o)) };
    case "last-week": { const d = subWeeks(now, 1); return { from: iso(startOfWeek(d, o)), to: iso(endOfWeek(d, o)) }; }
    case "this-month": return { from: iso(startOfMonth(now)), to: iso(endOfMonth(now)) };
    case "last-month": { const d = subMonths(now, 1); return { from: iso(startOfMonth(d)), to: iso(endOfMonth(d)) }; }
    case "this-year": return { from: iso(startOfYear(now)), to: iso(endOfYear(now)) };
    case "custom": return custom ?? { from: iso(startOfMonth(now)), to: iso(endOfMonth(now)) };
  }
}
export const inRange = (date: string, r: Range) => date >= r.from && date <= r.to;

export function nextDue(date: string, freq: "weekly" | "monthly" | "custom", customDays = 30) {
  const d = parseISO(date);
  return iso(freq === "weekly" ? addWeeks(d, 1) : freq === "monthly" ? addMonths(d, 1) : addDays(d, customDays));
}

export type DueStatus = "paid" | "partial" | "overdue" | "due-soon" | "upcoming";
export function dueStatus(dueDate: string, amount: number, paid: number, now = new Date()): DueStatus {
  if (paid >= amount && amount > 0) return "paid";
  const days = differenceInCalendarDays(parseISO(dueDate), now);
  if (days < 0) return "overdue";
  if (paid > 0) return "partial";
  if (days <= 7) return "due-soon";
  return "upcoming";
}
export const STATUS_LABEL: Record<DueStatus, string> = {
  paid: "Paid", partial: "Partially paid", overdue: "Overdue", "due-soon": "Due soon", upcoming: "Upcoming",
};

/** Daily buckets of income vs expense for a range. */
export function buildSeries(
  r: Range, income: { date: string; amount: number }[], expense: { date: string; amount: number }[],
) {
  const from = parseISO(r.from);
  const days = differenceInCalendarDays(parseISO(r.to), from) + 1;
  const byMonth = days > 62;
  const map = new Map<string, { label: string; income: number; expense: number }>();
  for (let i = 0; i < days; i++) {
    const d = addDays(from, i);
    const k = byMonth ? format(d, "yyyy-MM") : iso(d);
    if (!map.has(k)) map.set(k, { label: byMonth ? format(d, "MMM") : format(d, days <= 7 ? "EEE" : "d MMM"), income: 0, expense: 0 });
  }
  const key = (date: string) => (byMonth ? date.slice(0, 7) : date);
  income.forEach((x) => { const b = map.get(key(x.date)); if (b) b.income += x.amount; });
  expense.forEach((x) => { const b = map.get(key(x.date)); if (b) b.expense += x.amount; });
  return [...map.values()].map((b) => ({ ...b, income: b.income / 100, expense: b.expense / 100 }));
}

export function toCSV(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const head = Object.keys(rows[0]);
  const esc = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [head.join(","), ...rows.map((r) => head.map((h) => esc(r[h])).join(","))].join("\n");
}
