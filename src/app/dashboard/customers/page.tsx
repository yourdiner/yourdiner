import { requireTenantPageContext } from "@/lib/tenancy";
import { prisma } from "@/lib/db";
import { getModuleUpgradeLabel, restaurantHasModuleAccess } from "@/lib/plan-access";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { formatCurrency } from "@/lib/utils";

export default async function CustomersPage() {
  const tenant = await requireTenantPageContext();
  const hasAccess = await restaurantHasModuleAccess(tenant.restaurantId, "customers");

  if (!hasAccess) {
    const planLabel = getModuleUpgradeLabel("customers");
    return (
      <div>
        <div className="border-b px-8 py-4">
          <h1 className="text-2xl font-bold">Customers</h1>
        </div>
        <div className="p-6">
          <UpgradePrompt
            title={`Upgrade to ${planLabel} Plan`}
            description="Customer database and visit history are available on the Cafe Staff plan and above."
          />
        </div>
      </div>
    );
  }

  const customers = await prisma.customer.findMany({
    where: { restaurantId: tenant.restaurantId },
    select: {
      id: true,
      name: true,
      phone: true,
      visitCount: true,
      totalSpend: true,
      loyaltyPoints: true,
      isVip: true,
      membership: { select: { id: true, name: true, discountPercent: true } },
    },
    orderBy: { totalSpend: "desc" },
    take: 100,
  });

  return (
    <div>
      <div className="border-b px-8 py-4">
        <h1 className="text-2xl font-bold">Customers</h1>
        <p className="text-muted-foreground">Customer database and visit history</p>
      </div>
      <div className="p-6">
        <div className="rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Visits</th>
                <th className="px-4 py-3 font-medium">Total Spend</th>
                <th className="px-4 py-3 font-medium">Loyalty</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{customer.name}</td>
                  <td className="px-4 py-3">{customer.phone}</td>
                  <td className="px-4 py-3">{customer.visitCount}</td>
                  <td className="px-4 py-3">{formatCurrency(customer.totalSpend)}</td>
                  <td className="px-4 py-3">{customer.loyaltyPoints} pts</td>
                </tr>
              ))}
            </tbody>
          </table>
          {customers.length === 0 && (
            <p className="p-8 text-center text-muted-foreground">No customers yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
