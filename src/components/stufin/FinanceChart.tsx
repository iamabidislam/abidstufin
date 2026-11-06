import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useMoney } from "@/lib/hooks";

export function FinanceChart({ data, height = 220 }: { data: { label: string; income: number; expense: number }[]; height?: number }) {
  const money = useMoney();
  return (
    <div style={{ height }} className="-mx-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="gi" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--income)" stopOpacity={0.3} /><stop offset="100%" stopColor="var(--income)" stopOpacity={0} /></linearGradient>
            <linearGradient id="ge" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--expense)" stopOpacity={0.25} /><stop offset="100%" stopColor="var(--expense)" stopOpacity={0} /></linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} interval="preserveStartEnd" minTickGap={16} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} width={44} />
          <Tooltip
            cursor={{ stroke: "var(--border)" }}
            contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 14, fontSize: 13, color: "var(--foreground)" }}
            formatter={(v: number, n: string) => [money(Math.round(v * 100)), n === "income" ? "Earnings" : "Expenses"]}
          />
          <Area type="monotone" dataKey="income" stroke="var(--income)" strokeWidth={2.5} fill="url(#gi)" />
          <Area type="monotone" dataKey="expense" stroke="var(--expense)" strokeWidth={2.5} fill="url(#ge)" />
        </AreaChart>
      </ResponsiveContainer>
      <div className="mt-2 flex justify-center gap-5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-income" />Earnings</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-expense" />Expenses</span>
      </div>
    </div>
  );
}
