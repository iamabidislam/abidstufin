import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { Pencil, Plus, Receipt, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BottomSheet, CategoryForm, ExpenseForm } from "@/components/stufin/forms";
import { Confirm } from "@/components/stufin/confirm";
import { Card, COLORS, Empty, ICONS, PageTitle, PeriodPicker, SectionTitle, usePeriod } from "@/components/stufin/ui";
import { db, type Expense, type ExpenseCategory } from "@/lib/db";
import { inRange } from "@/lib/finance";
import { useFinance, useMoney } from "@/lib/hooks";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/expenses")({
  validateSearch: (s: Record<string, unknown>): { add?: string } => (typeof s["add"] === "string" ? { add: s["add"] } : {}),
  head: () => ({
    meta: [
      { title: "Expenses — STUFIN" },
      { name: "description", content: "Log spending in seconds with your saved categories." },
      { property: "og:title", content: "Expenses — STUFIN" },
      { property: "og:description", content: "Log spending in seconds with your saved categories." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Expenses,
});

type S = { kind: "expense"; item?: Expense; preset?: string } | { kind: "category"; item?: ExpenseCategory } | null;

function Expenses() {
  const d = useFinance();
  const money = useMoney();
  const p = usePeriod("this-month");
  const { add } = Route.useSearch();
  const nav = useNavigate();
  const [sheet, setSheet] = useState<S>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");

  useEffect(() => {
    if (!add) return;
    setSheet({ kind: "expense" });
    nav({ to: "/expenses", search: {}, replace: true });
  }, [add, nav]);

  const v = useMemo(() => {
    if (!d) return null;
    const inP = d.expenses.filter((e) => inRange(e.date, p.range));
    const total = inP.reduce((a, b) => a + b.amount, 0);
    const byCat = d.categories.map((c) => ({ c, total: inP.filter((e) => e.categoryId === c.id).reduce((a, b) => a + b.amount, 0), used: d.expenses.some((e) => e.categoryId === c.id) }))
      .sort((a, b) => b.total - a.total);
    const list = inP.filter((e) => !cat || e.categoryId === cat)
      .filter((e) => !q || `${e.categoryName} ${e.notes ?? ""} ${e.method ?? ""}`.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => b.date.localeCompare(a.date));
    return { total, byCat, list };
  }, [d, p.range.from, p.range.to, q, cat]);

  return (
    <>
      <PageTitle title="Expenses" sub="Spending" action={<Button onClick={() => setSheet({ kind: "expense" })}><Plus />Add</Button>} />

      <SectionTitle action={<Button size="sm" variant="soft" onClick={() => setSheet({ kind: "category" })}><Plus />Category</Button>}>Quick add</SectionTitle>
      {d?.categories.length ? (
        <div className="grid grid-cols-4 gap-2">
          {d.categories.map((c) => {
            const I = ICONS[c.icon] ?? Receipt;
            return (
              <button key={c.id} onClick={() => setSheet({ kind: "expense", preset: c.id })} className="card-surface flex flex-col items-center gap-1.5 px-1 py-3">
                <span className={cn("grid h-10 w-10 place-items-center rounded-full", COLORS[c.color])}><I className="h-5 w-5" /></span>
                <span className="w-full truncate text-xs font-medium">{c.name}</span>
              </button>
            );
          })}
        </div>
      ) : <Card><Empty title="No categories yet" hint="Create one like Groceries or Uber — it's saved for next time." /></Card>}

      <div className="mt-5"><PeriodPicker {...p.picker} /></div>
      <Card className="mt-3">
        <p className="text-sm text-muted-foreground">Total spent</p>
        <p className="text-3xl font-bold tabular-nums text-expense">{v ? money(v.total) : "—"}</p>
        <div className="mt-4 space-y-3">
          {v?.byCat.filter((x) => x.total > 0).map(({ c, total }) => (
            <div key={c.id}>
              <div className="flex justify-between text-sm"><span>{c.name}</span><span className="font-semibold tabular-nums">{money(total)}</span></div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-expense" style={{ width: `${(total / (v.total || 1)) * 100}%` }} /></div>
            </div>
          ))}
        </div>
      </Card>

      <SectionTitle>History</SectionTitle>
      <div className="mb-3 relative"><Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search expenses" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="-mx-5 mb-3 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none]">
        {[{ id: "", name: "All" }, ...(d?.categories ?? [])].map((c) => (
          <button key={c.id} onClick={() => setCat(c.id)} className={cn("shrink-0 rounded-full border px-3 py-1 text-sm", cat === c.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground")}>{c.name}</button>
        ))}
      </div>
      <Card className="divide-y divide-border p-0">
        {v?.list.length ? v.list.map((e) => {
          const c = d?.categories.find((x) => x.id === e.categoryId);
          const I = ICONS[c?.icon ?? ""] ?? Receipt;
          return (
            <div key={e.id} className="flex items-center gap-3 px-4 py-3">
              <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full", COLORS[c?.color ?? "red"])}><I className="h-5 w-5" /></span>
              <button className="min-w-0 flex-1 text-left" onClick={() => setSheet({ kind: "expense", item: e })}>
                <p className="truncate font-medium">{e.categoryName}</p>
                <p className="truncate text-xs text-muted-foreground">{format(parseISO(e.date), "d MMM")}{e.notes && ` · ${e.notes}`}</p>
              </button>
              <p className="font-semibold tabular-nums text-expense">−{money(e.amount)}</p>
              <Confirm title="Delete this expense?" onConfirm={async () => { await db.expenses.delete(e.id); toast.success("Expense deleted"); }}
                trigger={<button aria-label="Delete expense" className="p-1.5 text-muted-foreground"><Trash2 className="h-4 w-4" /></button>} />
            </div>
          );
        }) : <Empty title="No expenses in this period" />}
      </Card>

      {!!d?.categories.length && (
        <>
          <SectionTitle>Manage categories</SectionTitle>
          <Card className="divide-y divide-border p-0">
            {v?.byCat.map(({ c, used }) => (
              <div key={c.id} className="flex items-center justify-between px-4 py-2.5">
                <span className="font-medium">{c.name}</span>
                <div className="flex">
                  <button aria-label="Edit category" onClick={() => setSheet({ kind: "category", item: c })} className="p-1.5 text-muted-foreground"><Pencil className="h-4 w-4" /></button>
                  {used ? <span className="px-1.5 py-1 text-xs text-muted-foreground">in use</span> :
                    <Confirm title={`Delete ${c.name}?`} onConfirm={async () => { await db.expense_categories.delete(c.id); toast.success("Category deleted"); }}
                      trigger={<button aria-label="Delete category" className="p-1.5 text-muted-foreground"><Trash2 className="h-4 w-4" /></button>} />}
                </div>
              </div>
            ))}
          </Card>
        </>
      )}

      <BottomSheet open={!!sheet} onOpenChange={(o) => !o && setSheet(null)}
        title={sheet?.kind === "category" ? (sheet.item ? "Edit category" : "New category") : sheet?.item ? "Edit expense" : "Add expense"}>
        {sheet?.kind === "expense" && d && <ExpenseForm categories={d.categories} initial={sheet.item} presetCategory={sheet.preset} onDone={() => setSheet(null)} />}
        {sheet?.kind === "category" && d && <CategoryForm existing={d.categories} initial={sheet.item} onDone={() => setSheet(null)} />}
      </BottomSheet>
    </>
  );
}
