import Dexie, { type Table } from "dexie";

// All money is stored as integer minor units (pence).
export type ID = string;
export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export interface UserSettings {
  id: "me";
  firstName: string;
  currency: string;
  defaultRate: number; // pence
  weekStartsOn: 0 | 1;
  theme: "light" | "dark";
  notifications: boolean;
  lastBackup?: string;
  demo?: boolean;
}
export interface Workplace {
  id: ID; name: string; position?: string; rate: number; frequency?: string;
  startDate?: string; notes?: string; demo?: boolean;
}
export interface WorkShift {
  id: ID; workplaceId: ID; workplaceName: string; date: string; start: string; end: string;
  breakMin: number; rate: number; minutes: number; earned: number; notes?: string; demo?: boolean;
}
export interface EarningPayment { id: ID; shiftId: ID; amount: number; date: string; demo?: boolean }
export interface ExpenseCategory { id: ID; name: string; icon: string; color: string; demo?: boolean }
export interface Expense {
  id: ID; categoryId: ID; categoryName: string; amount: number; date: string;
  method?: string; notes?: string; demo?: boolean;
}
export interface TuitionRecord {
  id: ID; university: string; course?: string; total: number; discount: number;
  frequency?: string; deadline?: string; demo?: boolean;
}
export interface TuitionInstallment { id: ID; tuitionId: ID; name: string; amount: number; dueDate: string; demo?: boolean }
export interface TuitionPayment { id: ID; tuitionId: ID; installmentId: ID; amount: number; date: string; demo?: boolean }
export type Frequency = "weekly" | "monthly" | "custom";
export interface Accommodation {
  id: ID; name: string; address?: string; rent: number; frequency: Frequency; customDays?: number;
  nextDate: string; method?: string; notes?: string; demo?: boolean;
}
export interface RecurringPayment {
  id: ID; name: string; amount: number; frequency: Frequency; customDays?: number; nextDate: string; demo?: boolean;
}
export interface PaymentRecord {
  id: ID; refType: "rent" | "recurring" | "reminder"; refId: ID; name: string; amount: number;
  dueDate: string; date: string; demo?: boolean;
}
export interface Reminder {
  id: ID; name: string; type: string; amount: number; dueDate: string; remindDate: string;
  remindTime: string; repeat: "none" | "weekly" | "monthly" | "yearly"; paid: boolean; demo?: boolean;
}

class StufinDB extends Dexie {
  user_settings!: Table<UserSettings, string>;
  workplaces!: Table<Workplace, string>;
  work_shifts!: Table<WorkShift, string>;
  earnings_payments!: Table<EarningPayment, string>;
  expense_categories!: Table<ExpenseCategory, string>;
  expenses!: Table<Expense, string>;
  tuition_records!: Table<TuitionRecord, string>;
  tuition_installments!: Table<TuitionInstallment, string>;
  tuition_payments!: Table<TuitionPayment, string>;
  accommodation!: Table<Accommodation, string>;
  recurring_payments!: Table<RecurringPayment, string>;
  payment_records!: Table<PaymentRecord, string>;
  reminders!: Table<Reminder, string>;
  constructor() {
    super("stufin");
    this.version(1).stores({
      user_settings: "id",
      workplaces: "id, name",
      work_shifts: "id, workplaceId, date",
      earnings_payments: "id, shiftId, date",
      expense_categories: "id, &name",
      expenses: "id, categoryId, date",
      tuition_records: "id",
      tuition_installments: "id, tuitionId, dueDate",
      tuition_payments: "id, tuitionId, installmentId, date",
      accommodation: "id",
      recurring_payments: "id",
      payment_records: "id, refId, date",
      reminders: "id, dueDate",
    });
  }
}

export const db = new StufinDB();
export const TABLES = [
  "user_settings", "workplaces", "work_shifts", "earnings_payments", "expense_categories", "expenses",
  "tuition_records", "tuition_installments", "tuition_payments", "accommodation",
  "recurring_payments", "payment_records", "reminders",
] as const;
export type TableName = (typeof TABLES)[number];

export const DEFAULT_SETTINGS: UserSettings = {
  id: "me", firstName: "", currency: "GBP", defaultRate: 0, weekStartsOn: 1, theme: "light", notifications: false,
};

if (typeof window !== "undefined") {
  navigator.storage?.persist?.().catch(() => {});
}
