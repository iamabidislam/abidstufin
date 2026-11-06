import { createFileRoute, Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { BarChart3, ChevronRight, Database, Download, FileUp, Shield, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Confirm } from "@/components/stufin/confirm";
import { Card, Field, PageTitle, Segmented, SectionTitle, nativeSelect } from "@/components/stufin/ui";
import { clearDemo, exportCSV, exportJSON, loadDemo, parseBackup, restoreBackup, type ParsedBackup } from "@/lib/backup";
import { fromMinor, toMinor } from "@/lib/finance";
import { saveSettings, useSettings } from "@/lib/hooks";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings & backup — STUFIN" },
      { name: "description", content: "Currency, theme, reminders and private on-device backup for STUFIN." },
      { property: "og:title", content: "Settings & backup — STUFIN" },
      { property: "og:description", content: "Currency, theme, reminders and private on-device backup for STUFIN." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Settings,
});

function Settings() {
  const s = useSettings();
  const file = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<ParsedBackup | null>(null);
  const [rate, setRate] = useState<string | null>(null);

  const onFile = async (f?: File) => {
    if (!f) return;
    try { setPending(parseBackup(await f.text())); } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't read that file."); }
    if (file.current) file.current.value = "";
  };
  const notif = async (on: boolean) => {
    if (on && "Notification" in window) {
      const p = await Notification.requestPermission();
      if (p !== "granted") { toast.error("Notifications are blocked. On iPhone, add STUFIN to your Home Screen first."); return; }
    } else if (on) { toast.error("This browser doesn't support notifications."); return; }
    await saveSettings({ notifications: on });
  };

  return (
    <>
      <PageTitle title="Settings" />
      <Link to="/reports" className="card-surface mb-2 flex items-center gap-3 p-4">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-accent text-accent-foreground"><BarChart3 className="h-5 w-5" /></span>
        <span className="flex-1 font-medium">Reports & analytics</span><ChevronRight className="h-5 w-5 text-muted-foreground" />
      </Link>

      <SectionTitle>Profile</SectionTitle>
      <Card className="space-y-4">
        <Field label="First name"><Input defaultValue={s.firstName} key={s.firstName} onBlur={(e) => saveSettings({ firstName: e.target.value.trim() })} placeholder="Your name" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Currency">
            <select className={nativeSelect} value={s.currency} onChange={(e) => saveSettings({ currency: e.target.value })}>
              {["GBP", "EUR", "USD", "INR", "BDT", "PKR", "NGN", "CNY"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Default hourly rate">
            <Input inputMode="decimal" value={rate ?? (s.defaultRate ? fromMinor(s.defaultRate) : "")} onChange={(e) => setRate(e.target.value)}
              onBlur={() => { if (rate === null) return; const m = toMinor(rate || "0"); if (Number.isNaN(m)) toast.error("Enter a valid rate."); else saveSettings({ defaultRate: m }); setRate(null); }} placeholder="12.21" />
          </Field>
        </div>
        <Field label="Week starts on"><Segmented value={String(s.weekStartsOn)} onChange={(v) => saveSettings({ weekStartsOn: Number(v) as 0 | 1 })} options={[{ value: "1", label: "Monday" }, { value: "0", label: "Sunday" }]} /></Field>
        <Field label="Theme"><Segmented value={s.theme} onChange={(v) => saveSettings({ theme: v })} options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} /></Field>
        <div className="flex items-center justify-between"><div><p className="font-medium">Payment notifications</p><p className="text-xs text-muted-foreground">Alerts on your reminder date, while STUFIN is open</p></div><Switch checked={s.notifications} onCheckedChange={notif} /></div>
      </Card>

      <SectionTitle>Backup & data</SectionTitle>
      <Card className="space-y-3">
        <p className="text-sm text-muted-foreground"><Database className="mr-1 inline h-4 w-4" />Last backup: {s.lastBackup ? format(parseISO(s.lastBackup), "d MMM yyyy, HH:mm") : "never"}</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="soft" onClick={() => exportJSON().then(() => toast.success("Backup downloaded")).catch(() => toast.error("Backup failed."))}><Download />Backup</Button>
          <Button variant="soft" onClick={() => file.current?.click()}><FileUp />Restore</Button>
          <Button variant="soft" className="col-span-2" onClick={() => exportCSV().catch(() => toast.error("Export failed."))}><Download />Export transactions (CSV)</Button>
        </div>
        <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      </Card>

      <SectionTitle>Demo mode</SectionTitle>
      <Card className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground"><Sparkles className="mr-1 inline h-4 w-4" />Try STUFIN with clearly labelled sample data.</p>
        {s.demo ? <Button variant="soft" onClick={() => clearDemo().then(() => toast.success("Sample data removed"))}>Clear</Button>
          : <Button onClick={() => loadDemo().then(() => toast.success("Sample data added")).catch(() => toast.error("Couldn't add sample data."))}>Load</Button>}
      </Card>

      <SectionTitle>Privacy</SectionTitle>
      <Card className="space-y-2 text-sm text-muted-foreground">
        <p className="flex gap-2 font-medium text-foreground"><Shield className="h-4 w-4 text-income" />Your data stays on this device</p>
        <p>STUFIN has no account, no bank connection, no trackers and never uploads your records. Everything is stored in this browser on this device.</p>
        <p>Clearing website data or deleting the app can erase your records — download a backup regularly.</p>
        <p className="pt-2 text-xs">STUFIN 1.0 · Know your money. Control your future.</p>
      </Card>

      <div className="mt-6">
        <Confirm title="Erase all data?" description="Every record on this device will be deleted. This can't be undone." action="Erase everything"
          onConfirm={async () => { const { db, TABLES } = await import("@/lib/db"); await Promise.all(TABLES.map((t) => db.table(t).clear())); toast.success("All data erased"); }}
          trigger={<Button variant="ghost" className="w-full text-destructive">Erase all data</Button>} />
      </div>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent className="max-w-sm rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Replace your data?</AlertDialogTitle>
            <AlertDialogDescription>This backup has {pending?.counts} records. Restoring will replace everything currently on this device. Consider backing up first.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => pending && restoreBackup(pending).then(() => toast.success("Backup restored")).catch(() => toast.error("Restore failed — your data was not changed."))}>Restore</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
