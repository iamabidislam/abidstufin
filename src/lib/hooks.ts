import { useLiveQuery } from "dexie-react-hooks";
import { useEffect } from "react";
import { db, DEFAULT_SETTINGS, type UserSettings } from "./db";
import { formatMoney } from "./finance";

export function useSettings(): UserSettings {
  const s = useLiveQuery(() => db.user_settings.get("me"), []);
  return s ?? DEFAULT_SETTINGS;
}
export async function saveSettings(patch: Partial<UserSettings>) {
  const cur = (await db.user_settings.get("me")) ?? DEFAULT_SETTINGS;
  await db.user_settings.put({ ...cur, ...patch, id: "me" });
}
export function useMoney() {
  const { currency } = useSettings();
  return (minor: number) => formatMoney(minor, currency);
}
export function useThemeSync() {
  const { theme } = useSettings();
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);
}

/** All core data, live. Undefined while loading. */
export function useFinance() {
  return useLiveQuery(async () => {
    const [workplaces, shifts, earnPay, categories, expenses, tuition, installments, tuitionPay, accom, recurring, records, reminders] =
      await Promise.all([
        db.workplaces.toArray(), db.work_shifts.toArray(), db.earnings_payments.toArray(),
        db.expense_categories.toArray(), db.expenses.toArray(), db.tuition_records.toArray(),
        db.tuition_installments.toArray(), db.tuition_payments.toArray(), db.accommodation.toArray(),
        db.recurring_payments.toArray(), db.payment_records.toArray(), db.reminders.toArray(),
      ]);
    return { workplaces, shifts, earnPay, categories, expenses, tuition, installments, tuitionPay, accom, recurring, records, reminders };
  }, []);
}
export type FinanceData = NonNullable<ReturnType<typeof useFinance>>;

/** Shows local notifications for due reminders while the app is open. Never marks anything paid. */
export function useReminderNotifier() {
  const { notifications } = useSettings();
  useEffect(() => {
    if (!notifications || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const check = async () => {
      const now = new Date();
      const stamp = `${now.toISOString().slice(0, 10)}T${now.toTimeString().slice(0, 5)}`;
      const seen: string[] = JSON.parse(localStorage.getItem("stufin-notified") || "[]");
      const due = (await db.reminders.toArray()).filter((r) => !r.paid && `${r.remindDate}T${r.remindTime}` <= stamp);
      for (const r of due) {
        const k = `${r.id}:${r.dueDate}`;
        if (seen.includes(k)) continue;
        new Notification("STUFIN payment reminder", { body: `${r.name} is due ${r.dueDate}`, icon: "/icon-512.png" });
        seen.push(k);
      }
      localStorage.setItem("stufin-notified", JSON.stringify(seen.slice(-200)));
    };
    check();
    const t = setInterval(check, 60_000);
    return () => clearInterval(t);
  }, [notifications]);
}
