import { requireTenantPageContext } from "@/lib/tenancy";
import { getInvoices } from "@/features/subscriptions/actions";
import { InvoicesView } from "@/features/subscriptions/components/invoices-view";

export default async function InvoicesPage() {
  await requireTenantPageContext();
  const invoices = await getInvoices();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Invoices</h1>
        <p className="text-muted-foreground">Billing history and downloadable receipts</p>
      </div>
      <InvoicesView invoices={invoices} />
    </div>
  );
}
