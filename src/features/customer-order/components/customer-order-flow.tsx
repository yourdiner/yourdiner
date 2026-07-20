"use client";

import { useState, useEffect, useTransition, useCallback, useRef } from "react";
import Link from "next/link";
import { PublicMenuView, type MenuData } from "@/features/menu/components/public-menu-view";
import { CustomerIdentifyForm } from "@/features/customer-order/components/customer-identify-form";
import {
  fetchCustomerSessionStatus,
  type CustomerSessionStatus,
} from "@/lib/customer-order-client";
import { TableSessionStatus } from "@prisma/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type SessionState = {
  tableSessionId: string;
  diningSessionId: string | null;
  customerName: string;
  status: string;
};

type Props = {
  menu: MenuData;
  tableSlug: string;
  tableLabel: string;
  orderingAllowed: boolean;
  initialStatus: string;
  initialSession: SessionState | null;
  /** Browse-only general menu path (e.g. /menu) */
  generalMenuHref?: string;
};

const POLL_MS = 5000;

function GeneralMenuLink({ href }: { href: string }) {
  return (
    <Button asChild variant="outline" className="mt-6">
      <Link href={href}>View menu instead</Link>
    </Button>
  );
}

export function CustomerOrderFlow({
  menu,
  tableSlug,
  tableLabel,
  orderingAllowed,
  initialStatus,
  initialSession,
  generalMenuHref = "/menu",
}: Props) {
  const [session, setSession] = useState<SessionState | null>(initialSession);
  const [status, setStatus] = useState(initialStatus);
  const [, startTransition] = useTransition();
  const prevStatusRef = useRef(initialStatus);

  const refreshStatus = useCallback(async () => {
    const result = await fetchCustomerSessionStatus(tableSlug);
    if (!result.ok) return;

    const data = result.data as CustomerSessionStatus;
    if (data.tableOccupied) {
      setStatus("TABLE_OCCUPIED");
      return;
    }

    setStatus(data.status);

    if (data.status === TableSessionStatus.PENDING_APPROVAL) {
      if (data.tableSessionId && data.customerName) {
        setSession({
          tableSessionId: data.tableSessionId,
          diningSessionId: null,
          customerName: data.customerName,
          status: data.status,
        });
      }
    }

    if (
      data.status === TableSessionStatus.ACTIVE &&
      data.diningSessionId &&
      data.customerName
    ) {
      setSession({
        tableSessionId: data.tableSessionId || "",
        diningSessionId: data.diningSessionId,
        customerName: data.customerName,
        status: data.status,
      });
    }

    if (
      data.status === TableSessionStatus.REJECTED ||
      data.status === TableSessionStatus.EXPIRED ||
      data.status === TableSessionStatus.CLOSED
    ) {
      setSession(null);
    }
  }, [tableSlug]);

  useEffect(() => {
    if (status !== TableSessionStatus.PENDING_APPROVAL) return;
    const id = setInterval(() => {
      startTransition(() => {
        void refreshStatus();
      });
    }, POLL_MS);
    return () => clearInterval(id);
  }, [status, refreshStatus, startTransition]);

  useEffect(() => {
    if (
      prevStatusRef.current === TableSessionStatus.PENDING_APPROVAL &&
      status === TableSessionStatus.ACTIVE
    ) {
      toast.success("Your table has been approved. You can order now!");
    }
    prevStatusRef.current = status;
  }, [status]);

  // Without table-ordering feature: browse-only — never cart.
  if (!orderingAllowed) {
    return <PublicMenuView menu={menu} tableLabel={tableLabel} mode="browse" />;
  }

  if (status === "TABLE_OCCUPIED") {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-center">
        <div>
          <h1 className="text-xl font-bold">Table in use</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This table already has an active dining session. Please contact restaurant staff.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            You can still browse the menu without placing an order.
          </p>
          <GeneralMenuLink href={generalMenuHref} />
        </div>
      </div>
    );
  }

  if (
    status === TableSessionStatus.REJECTED ||
    status === "SESSION_REJECTED"
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-center">
        <div>
          <h1 className="text-xl font-bold">Session not approved</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your dining session was not approved. Please contact the restaurant staff for
            assistance.
          </p>
          <GeneralMenuLink href={generalMenuHref} />
        </div>
      </div>
    );
  }

  if (
    status === TableSessionStatus.EXPIRED ||
    status === TableSessionStatus.CLOSED ||
    status === "SESSION_ENDED"
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-center">
        <div>
          <h1 className="text-xl font-bold">Session ended</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your dining session has ended. Please scan the QR again.
          </p>
          <GeneralMenuLink href={generalMenuHref} />
        </div>
      </div>
    );
  }

  const orderingEnabled =
    status === TableSessionStatus.ACTIVE && !!session?.diningSessionId;

  const awaitingApproval =
    status === TableSessionStatus.PENDING_APPROVAL ||
    (!!session && !session.diningSessionId && status !== "NONE");

  if (awaitingApproval || orderingEnabled) {
    return (
      <PublicMenuView
        menu={menu}
        tableLabel={tableLabel}
        tableSlug={tableSlug}
        customerName={session?.customerName}
        mode={orderingEnabled ? "customer" : "browse"}
        orderingLocked={!orderingEnabled}
        diningSessionId={orderingEnabled ? session!.diningSessionId! : undefined}
        onSessionEnded={() => {
          setSession(null);
          setStatus("SESSION_ENDED");
        }}
      />
    );
  }

  if (!session?.diningSessionId) {
    return (
      <CustomerIdentifyForm
        tableSlug={tableSlug}
        tableLabel={tableLabel}
        restaurantName={menu.restaurant.name}
        generalMenuHref={generalMenuHref}
        onSessionStarted={(s) => {
          setSession({
            tableSessionId: s.tableSessionId,
            diningSessionId: s.diningSessionId,
            customerName: s.customerName,
            status: s.status,
          });
          setStatus(s.status);
        }}
        onTableOccupied={() => setStatus("TABLE_OCCUPIED")}
      />
    );
  }

  return null;
}
