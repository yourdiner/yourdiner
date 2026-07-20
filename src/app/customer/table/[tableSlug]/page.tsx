import { requireTenantPageContext } from "@/lib/tenancy";
import { getPublicMenu } from "@/features/menu/actions";
import { CustomerOrderFlow } from "@/features/customer-order/components/customer-order-flow";
import { restaurantHasCustomerOrdering } from "@/lib/customer-order-service";
import { resolveTableByQrSlug } from "@/lib/table-qr";
import {
  getBlockingTableSession,
  loadCustomerTableSessionByToken,
  getSessionTokenFromRequest,
  resolveTerminalTableSessionByToken,
} from "@/lib/table-sessions";
import { clearCustomerSessionCookie } from "@/lib/customer-session-cookie";
import { getActiveDiningSessionForTable } from "@/lib/dining-session";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CustomerTablePage({
  params,
}: {
  params: Promise<{ tableSlug: string }>;
}) {
  const { tableSlug } = await params;
  const tenant = await requireTenantPageContext();

  let table;
  try {
    table = await resolveTableByQrSlug(tenant.restaurantId, tableSlug);
  } catch {
    notFound();
  }

  const [menuData, orderingAllowed, token] = await Promise.all([
    getPublicMenu(tenant.restaurantId),
    restaurantHasCustomerOrdering(tenant.restaurantId),
    getSessionTokenFromRequest(),
  ]);

  if (!menuData) notFound();

  const tableLabel = table.name || `Table ${table.number}`;
  const menu = menuData as Parameters<typeof CustomerOrderFlow>[0]["menu"];

  const ownSession = token
    ? await loadCustomerTableSessionByToken(token, tenant.restaurantId)
    : null;

  const terminalSession =
    token && (!ownSession || ownSession.tableId !== table.id)
      ? await resolveTerminalTableSessionByToken(token, tenant.restaurantId, table.id)
      : null;

  if (terminalSession) {
    await clearCustomerSessionCookie();
  }

  const ownsThisTable = Boolean(ownSession && ownSession.tableId === table.id);

  const [blockingCustomerSession, activeDining] = ownsThisTable
    ? [null, null]
    : await Promise.all([
        getBlockingTableSession(table.id),
        getActiveDiningSessionForTable(table.id),
      ]);

  const tableOccupiedByOthers = Boolean(blockingCustomerSession || activeDining);

  const initialStatus =
    ownSession && ownSession.tableId === table.id
      ? ownSession.status
      : terminalSession
        ? terminalSession.status
        : tableOccupiedByOthers
          ? "TABLE_OCCUPIED"
          : "NONE";

  return (
    <CustomerOrderFlow
      menu={menu}
      tableSlug={table.qrSlug}
      tableLabel={tableLabel}
      orderingAllowed={orderingAllowed}
      initialStatus={initialStatus}
      generalMenuHref="/menu"
      initialSession={
        ownSession && ownSession.tableId === table.id
          ? {
              tableSessionId: ownSession.tableSessionId,
              diningSessionId: ownSession.diningSessionId,
              customerName: ownSession.customerName || "Guest",
              status: ownSession.status,
            }
          : null
      }
    />
  );
}
