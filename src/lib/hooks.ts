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
