import type { FinanceData } from "./hooks";
import { dueStatus, type DueStatus } from "./finance";

export interface DueItem {
  key: string; kind: "tuition" | "rent" | "bill" | "reminder"; refId: string; name: string;
  amount: number; paid: number; dueDate: string; status: DueStatus;
}

export function upcoming(d: FinanceData): DueItem[] {
  const items: DueItem[] = [];
  for (const i of d.installments) {
    const t = d.tuition.find((x) => x.id === i.tuitionId);
    const paid = d.tuitionPay.filter((p) => p.installmentId === i.id).reduce((s, p) => s + p.amount, 0);
    items.push({ key: i.id, kind: "tuition", refId: i.id, name: `${t?.university ?? "Tuition"} · ${i.name}`, amount: i.amount, paid, dueDate: i.dueDate, status: dueStatus(i.dueDate, i.amount, paid) });
  }
  for (const a of d.accom) items.push({ key: a.id, kind: "rent", refId: a.id, name: `Rent · ${a.name}`, amount: a.rent, paid: 0, dueDate: a.nextDate, status: dueStatus(a.nextDate, a.rent, 0) });
  for (const r of d.recurring) items.push({ key: r.id, kind: "bill", refId: r.id, name: r.name, amount: r.amount, paid: 0, dueDate: r.nextDate, status: dueStatus(r.nextDate, r.amount, 0) });
  for (const r of d.reminders) items.push({ key: r.id, kind: "reminder", refId: r.id, name: r.name, amount: r.amount, paid: r.paid ? r.amount : 0, dueDate: r.dueDate, status: r.paid ? "paid" : dueStatus(r.dueDate, Math.max(r.amount, 1), 0) });
  return items.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
