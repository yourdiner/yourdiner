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

function StatusScreen({
  title,
  body,
  generalMenuHref,
}: {
  title: string;
  body: string;
  generalMenuHref: string;
}) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-[var(--pm-surface)] px-[var(--pm-margin-mobile)] py-10 md:px-[var(--pm-margin-desktop)]">
      <div className="w-full max-w-md rounded-[var(--pm-radius-xl)] border border-[var(--pm-outline-variant)] bg-[var(--pm-surface-container-lowest)] px-6 py-10 text-center shadow-[var(--pm-shadow-sm)]">
        <h1 className="font-display text-xl text-[var(--pm-on-surface)]">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--pm-on-surface-variant)]">{body}</p>
        <Link href={generalMenuHref} className="pm-btn-secondary mt-6 w-full py-3">
          View menu instead
        </Link>
      </div>
    </div>
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
      <StatusScreen
        title="Table in use"
        body="This table already has an active dining session. Please contact restaurant staff. You can still browse the menu without placing an order."
        generalMenuHref={generalMenuHref}
      />
    );
  }

  if (status === TableSessionStatus.REJECTED || status === "SESSION_REJECTED") {
    return (
      <StatusScreen
        title="Session not approved"
        body="Your dining session was not approved. Please contact the restaurant staff for assistance."
        generalMenuHref={generalMenuHref}
      />
    );
  }

  if (
    status === TableSessionStatus.EXPIRED ||
    status === TableSessionStatus.CLOSED ||
    status === "SESSION_ENDED"
  ) {
    return (
      <StatusScreen
        title="Session ended"
        body="Your dining session has ended. Please scan the QR again."
        generalMenuHref={generalMenuHref}
      />
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
        branding={menu.restaurant.branding}
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
