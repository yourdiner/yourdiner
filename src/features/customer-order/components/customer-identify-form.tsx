"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { RequiredLabel } from "@/components/ui/required-label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  lookupCustomerForOrder,
  startCustomerSession,
} from "@/lib/customer-order-client";

type Props = {
  tableSlug: string;
  tableLabel: string;
  restaurantName: string;
  generalMenuHref?: string;
  onSessionStarted: (session: {
    tableSessionId: string;
    diningSessionId: string | null;
    customerName: string;
    status: string;
  }) => void;
  onTableOccupied?: () => void;
};

function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  const key = "cafe_pos_device_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

function isTableOccupiedError(error: string, code?: string) {
  if (
    code === "TABLE_HAS_ACTIVE_SESSION" ||
    code === "TABLE_OCCUPIED" ||
    code === "TABLE_NOT_AVAILABLE"
  ) {
    return /session|occupied|not available/i.test(error);
  }
  return /active (dining )?session/i.test(error);
}

export function CustomerIdentifyForm({
  tableSlug,
  tableLabel,
  restaurantName,
  generalMenuHref = "/menu",
  onSessionStarted,
  onTableOccupied,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [showGeneralMenuLink, setShowGeneralMenuLink] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<{
    name: string;
  } | null>(null);

  async function handlePhoneChange(value: string) {
    setPhone(value);
    setError("");
    setShowGeneralMenuLink(false);
    const digits = value.replace(/\D/g, "");
    if (digits.length >= 10) {
      try {
        const customer = await lookupCustomerForOrder(value);
        if (customer?.name) {
          setName(customer.name);
          setCustomerInfo({ name: customer.name });
        } else {
          setCustomerInfo(null);
        }
      } catch {
        setCustomerInfo(null);
      }
    } else {
      setCustomerInfo(null);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setShowGeneralMenuLink(false);

    const normalizedPhone = phone.replace(/\D/g, "").slice(-10);
    if (normalizedPhone.length < 10) {
      setError("Phone number must be 10 digits");
      return;
    }
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    startTransition(async () => {
      const result = await startCustomerSession({
        tableSlug,
        phone: normalizedPhone,
        name: name.trim(),
        deviceId: getDeviceId(),
      });
      if (!result.ok) {
        setError(result.error);
        if (isTableOccupiedError(result.error, result.code)) {
          setShowGeneralMenuLink(true);
          onTableOccupied?.();
        }
        return;
      }
      onSessionStarted({
        tableSessionId: result.data.tableSessionId,
        diningSessionId: result.data.diningSessionId ?? null,
        customerName: result.data.customerName,
        status: result.data.status,
      });
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--pm-surface,#fcf9f8)] p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-6 border border-[var(--pm-border-card,#e8e4df)] bg-white p-8 shadow-sm"
      >
        <div className="text-center">
          <p className="text-sm uppercase tracking-widest text-[var(--pm-on-surface-variant)]">
            {restaurantName}
          </p>
          <h1 className="font-display mt-2 text-2xl text-[var(--pm-primary)]">
            Welcome to {tableLabel}
          </h1>
          <p className="mt-2 text-sm text-[var(--pm-on-surface-variant)]">
            Enter your details to start ordering
          </p>
        </div>

        <div className="space-y-2">
          <RequiredLabel htmlFor="customer-phone">Mobile number</RequiredLabel>
          <Input
            id="customer-phone"
            type="tel"
            inputMode="numeric"
            placeholder="10-digit mobile"
            value={phone}
            onChange={(e) => handlePhoneChange(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <RequiredLabel htmlFor="customer-name">Your name</RequiredLabel>
          <Input
            id="customer-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
          />
        </div>

        {customerInfo && (
          <p className="text-sm text-[var(--pm-on-surface-variant)]">
            Welcome back, {customerInfo.name}
          </p>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {showGeneralMenuLink && (
          <Button asChild type="button" variant="outline" className="w-full">
            <Link href={generalMenuHref}>View menu instead</Link>
          </Button>
        )}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Starting..." : "Continue"}
        </Button>
      </form>
    </div>
  );
}
