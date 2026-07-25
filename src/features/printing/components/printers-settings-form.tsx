"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { PrinterEndpointConfig, PrinterSettings } from "@/features/printing/types";
import {
  getPrintJobsAction,
  savePrinterSettingsAction,
  testPrintAction,
} from "@/features/printing/actions";
import { browserPrintHtml } from "@/features/printing/browser-print";

type JobRow = {
  id: string;
  type: string;
  status: string;
  printerRole: string;
  connectionType: string;
  errorMessage: string | null;
  createdAt: Date | string;
};

function EndpointEditor({
  title,
  value,
  onChange,
}: {
  title: string;
  value: PrinterEndpointConfig;
  onChange: (next: PrinterEndpointConfig) => void;
}) {
  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        <div className="flex items-center gap-2">
          <Switch
            checked={value.enabled}
            onCheckedChange={(enabled) => onChange({ ...value, enabled })}
          />
          <Label>Enabled</Label>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Printer name</Label>
          <Input
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Connection</Label>
          <Select
            value={value.connectionType}
            onValueChange={(connectionType) =>
              onChange({
                ...value,
                connectionType: connectionType as PrinterEndpointConfig["connectionType"],
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="BROWSER">Browser</SelectItem>
              <SelectItem value="LAN">LAN (local agent)</SelectItem>
              <SelectItem value="USB">USB (coming soon)</SelectItem>
              <SelectItem value="BLUETOOTH">Bluetooth (coming soon)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Paper width</Label>
          <Select
            value={value.paperWidth}
            onValueChange={(paperWidth) =>
              onChange({ ...value, paperWidth: paperWidth as "58" | "80" })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="58">58mm</SelectItem>
              <SelectItem value="80">80mm</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Copies</Label>
          <Input
            type="number"
            min={1}
            max={5}
            value={value.copies}
            onChange={(e) => onChange({ ...value, copies: Number(e.target.value) || 1 })}
          />
        </div>
        {value.connectionType === "LAN" && (
          <>
            <div className="space-y-2">
              <Label>Printer IP</Label>
              <Input
                value={value.ipAddress ?? ""}
                onChange={(e) => onChange({ ...value, ipAddress: e.target.value })}
                placeholder="192.168.1.50"
              />
            </div>
            <div className="space-y-2">
              <Label>Port</Label>
              <Input
                type="number"
                value={value.port ?? 9100}
                onChange={(e) => onChange({ ...value, port: Number(e.target.value) || 9100 })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Local print agent URL</Label>
              <Input
                value={value.printAgentUrl ?? ""}
                onChange={(e) => onChange({ ...value, printAgentUrl: e.target.value })}
                placeholder="http://127.0.0.1:9101/print"
              />
              <p className="text-xs text-muted-foreground">
                Cloud servers cannot reach LAN printers. Run a local agent that accepts ESC/POS
                jobs.
              </p>
            </div>
          </>
        )}
        <div className="space-y-2 sm:col-span-2">
          <Label>Header</Label>
          <Input
            value={value.header ?? ""}
            onChange={(e) => onChange({ ...value, header: e.target.value })}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Footer message</Label>
          <Input
            value={value.footerMessage ?? ""}
            onChange={(e) => onChange({ ...value, footerMessage: e.target.value })}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        <div className="flex items-center gap-2">
          <Switch
            checked={value.printLogo}
            onCheckedChange={(printLogo) => onChange({ ...value, printLogo })}
          />
          <Label>Print logo</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={value.autoCut}
            onCheckedChange={(autoCut) => onChange({ ...value, autoCut })}
          />
          <Label>Auto cut</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={value.cashDrawerTrigger}
            onCheckedChange={(cashDrawerTrigger) => onChange({ ...value, cashDrawerTrigger })}
          />
          <Label>Cash drawer</Label>
        </div>
      </div>
    </div>
  );
}

function statusBadge(status: string) {
  if (status === "COMPLETED") return <Badge>Online / OK</Badge>;
  if (status === "FAILED") return <Badge variant="destructive">Error</Badge>;
  if (status === "PRINTING") return <Badge variant="outline">Printing</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}

export function PrintersSettingsForm({
  initialSettings,
  initialJobs,
}: {
  initialSettings: PrinterSettings;
  initialJobs: JobRow[];
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [jobs, setJobs] = useState(initialJobs);
  const [pending, startTransition] = useTransition();

  const lastBilling = useMemo(
    () => jobs.find((j) => j.printerRole === "billing"),
    [jobs]
  );
  const lastKitchen = useMemo(
    () => jobs.find((j) => j.printerRole === "kitchen"),
    [jobs]
  );

  function save() {
    startTransition(async () => {
      const result = await savePrinterSettingsAction(settings);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Printer settings saved");
    });
  }

  function runTest(role: "billing" | "kitchen") {
    startTransition(async () => {
      const result = await testPrintAction(role);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.result.needsBrowserPrint && result.result.html) {
        browserPrintHtml(result.result.html);
        toast.success("Sample sent to browser print");
      } else if (result.result.status === "FAILED") {
        toast.error(result.result.errorMessage || "Printing failed. Retry?");
      } else {
        toast.success("Test print completed");
      }
      const jobsResult = await getPrintJobsAction();
      if (jobsResult.ok) setJobs(jobsResult.jobs);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <div className="rounded-lg border px-3 py-2 text-sm">
          Billing: {lastBilling ? statusBadge(lastBilling.status) : <Badge variant="outline">Ready</Badge>}
        </div>
        <div className="rounded-lg border px-3 py-2 text-sm">
          Kitchen: {lastKitchen ? statusBadge(lastKitchen.status) : <Badge variant="outline">Ready</Badge>}
        </div>
      </div>

      <div className="flex flex-wrap gap-6 rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <Switch
            checked={settings.autoPrintKitchenTickets}
            onCheckedChange={(autoPrintKitchenTickets) =>
              setSettings((s) => ({ ...s, autoPrintKitchenTickets }))
            }
          />
          <Label>Auto print kitchen tickets</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={settings.autoPrintCustomerBills}
            onCheckedChange={(autoPrintCustomerBills) =>
              setSettings((s) => ({ ...s, autoPrintCustomerBills }))
            }
          />
          <Label>Auto print customer bills</Label>
        </div>
      </div>

      <EndpointEditor
        title="Billing printer"
        value={settings.billingPrinter}
        onChange={(billingPrinter) => setSettings((s) => ({ ...s, billingPrinter }))}
      />
      <EndpointEditor
        title="Kitchen printer"
        value={settings.kitchenPrinter}
        onChange={(kitchenPrinter) => setSettings((s) => ({ ...s, kitchenPrinter }))}
      />

      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={pending}>
          Save settings
        </Button>
        <Button variant="outline" disabled={pending} onClick={() => runTest("billing")}>
          Test billing print
        </Button>
        <Button variant="outline" disabled={pending} onClick={() => runTest("kitchen")}>
          Test kitchen print
        </Button>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">Recent print jobs</h3>
        {jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No print jobs yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Connection</th>
                  <th className="px-3 py-2">When</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} className="border-t">
                    <td className="px-3 py-2">{j.type}</td>
                    <td className="px-3 py-2">{j.printerRole}</td>
                    <td className="px-3 py-2">
                      {statusBadge(j.status)}
                      {j.errorMessage && (
                        <div className="text-xs text-destructive">{j.errorMessage}</div>
                      )}
                    </td>
                    <td className="px-3 py-2">{j.connectionType}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {new Date(j.createdAt).toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
