"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";

type InvoiceRow = {
  id: string;
  invoiceNumber: string | null;
  amount: number;
  taxAmount: number;
  status: string;
  billingPeriodStart: Date | null;
  billingPeriodEnd: Date | null;
  paymentMethod: string | null;
  invoiceUrl: string | null;
  paidAt: Date | null;
  createdAt: Date;
};

export function InvoicesView({
  invoices,
}: {
  invoices: InvoiceRow[];
}) {
  if (invoices.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No invoices yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="rounded-xl border overflow-x-auto">
      <table className="w-full min-w-[800px]">
        <thead>
          <tr className="border-b bg-muted/50 text-left text-sm">
            <th className="px-4 py-3 font-medium">Invoice #</th>
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 font-medium">Billing Period</th>
            <th className="px-4 py-3 font-medium">Amount</th>
            <th className="px-4 py-3 font-medium">GST</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Payment Method</th>
            <th className="px-4 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <tr key={inv.id} className="border-b">
              <td className="px-4 py-3 text-sm">{inv.invoiceNumber ?? inv.id.slice(-8)}</td>
              <td className="px-4 py-3 text-sm">
                {formatDate(inv.paidAt ?? inv.createdAt)}
              </td>
              <td className="px-4 py-3 text-sm">
                {inv.billingPeriodStart && inv.billingPeriodEnd
                  ? `${formatDate(inv.billingPeriodStart)} – ${formatDate(inv.billingPeriodEnd)}`
                  : "—"}
              </td>
              <td className="px-4 py-3 text-sm">{formatCurrency(inv.amount)}</td>
              <td className="px-4 py-3 text-sm">{formatCurrency(inv.taxAmount)}</td>
              <td className="px-4 py-3">
                <Badge variant={inv.status === "PAID" ? "default" : "secondary"}>
                  {inv.status}
                </Badge>
              </td>
              <td className="px-4 py-3 text-sm">{inv.paymentMethod ?? "—"}</td>
              <td className="px-4 py-3">
                {inv.invoiceUrl && (
                  <a href={inv.invoiceUrl} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline">
                      Download
                    </Button>
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
