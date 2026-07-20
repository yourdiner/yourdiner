"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { updateBranding } from "@/lib/branding-client";
import { updateRestaurantSettings } from "@/lib/settings-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RequiredLabel } from "@/components/ui/required-label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import type { TaxSettings } from "@/lib/tax-settings";

const taxSchema = z.object({
  taxPercent: z.coerce.number().min(0).max(100),
  taxInclusive: z.boolean(),
  gstNumber: z.string().optional(),
  panNumber: z.string().optional(),
  receiptFooter: z.string().optional(),
  invoiceFooter: z.string().optional(),
});

type TaxInput = z.infer<typeof taxSchema>;

interface SettingsTaxReceiptProps {
  branding: {
    gstNumber: string | null;
    panNumber: string | null;
    receiptFooter: string | null;
    invoiceFooter: string | null;
  } | null;
  taxSettings: TaxSettings;
}

export function SettingsTaxReceipt({ branding, taxSettings }: SettingsTaxReceiptProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const form = useForm<TaxInput>({
    resolver: zodResolver(taxSchema),
    defaultValues: {
      taxPercent: taxSettings.taxPercent,
      taxInclusive: taxSettings.taxInclusive,
      gstNumber: branding?.gstNumber || "",
      panNumber: branding?.panNumber || "",
      receiptFooter: branding?.receiptFooter || "",
      invoiceFooter: branding?.invoiceFooter || "",
    },
  });

  const taxPercent = form.watch("taxPercent");
  const taxInclusive = form.watch("taxInclusive");

  const onSubmit = async (data: TaxInput) => {
    setLoading(true);
    try {
      const settingsResult = await updateRestaurantSettings({
        taxPercent: data.taxPercent,
        taxInclusive: data.taxInclusive,
      });
      if (!settingsResult.ok) {
        toast.error(settingsResult.error);
        return;
      }

      const brandingResult = await updateBranding({
        gstNumber: data.gstNumber,
        panNumber: data.panNumber,
        receiptFooter: data.receiptFooter,
        invoiceFooter: data.invoiceFooter,
      });
      if (!brandingResult.ok) {
        toast.error(brandingResult.error);
        return;
      }

      toast.success("Tax & receipt settings saved");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tax & Receipt</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <RequiredLabel>Tax Percentage (%)</RequiredLabel>
            <Input
              type="number"
              min={0}
              max={100}
              step={0.1}
              {...form.register("taxPercent")}
            />
            <p className="text-xs text-muted-foreground">
              Applied to order subtotals when calculating bills
            </p>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4 md:col-span-1">
            <div>
              <Label>Tax inclusive pricing</Label>
              <p className="text-xs text-muted-foreground">
                Item prices already include tax
              </p>
            </div>
            <Switch
              checked={taxInclusive}
              onCheckedChange={(v) => form.setValue("taxInclusive", v)}
            />
          </div>
          <div className="md:col-span-2 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
            {taxInclusive
              ? `Tax of ${taxPercent}% is included in item prices and extracted for receipts.`
              : `${taxPercent}% tax is added on top of the subtotal on every order.`}
          </div>
          <div className="space-y-2">
            <Label>GST Number</Label>
            <Input {...form.register("gstNumber")} />
          </div>
          <div className="space-y-2">
            <Label>PAN Number</Label>
            <Input {...form.register("panNumber")} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Receipt Footer</Label>
            <Textarea {...form.register("receiptFooter")} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Invoice Footer</Label>
            <Textarea {...form.register("invoiceFooter")} />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Tax & Receipt"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
