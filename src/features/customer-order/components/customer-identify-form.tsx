"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  lookupCustomerForOrder,
  startCustomerSession,
} from "@/lib/customer-order-client";

type BrandingTheme = {
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
};

type Props = {
  tableSlug: string;
  tableLabel: string;
  restaurantName: string;
  branding?: BrandingTheme | null;
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
  branding,
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

  const themeStyle = {
    "--pm-primary": branding?.primaryColor || "#425646",
    "--pm-secondary": branding?.secondaryColor || branding?.accentColor || "#8d4c40",
    "--pm-primary-container": branding?.primaryColor || "#5a6e5d",
  } as React.CSSProperties;

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
    <div
      className="flex min-h-[70vh] items-center justify-center bg-[var(--pm-surface)] px-[var(--pm-margin-mobile)] py-10 md:px-[var(--pm-margin-desktop)]"
      style={themeStyle}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-6 rounded-[var(--pm-radius-xl)] border border-[var(--pm-outline-variant)] bg-[var(--pm-surface-container-lowest)] p-6 shadow-[var(--pm-shadow-sm)] sm:p-8"
      >
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--pm-on-surface-variant)]">
            {restaurantName}
          </p>
          <h1 className="font-display mt-2 text-2xl text-[var(--pm-on-surface)]">
            Welcome to {tableLabel}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--pm-on-surface-variant)]">
            Enter your details to start ordering
          </p>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="customer-phone"
            className="block text-sm font-medium text-[var(--pm-on-surface)]"
          >
            Mobile number <span className="text-[var(--pm-secondary)]">*</span>
          </label>
          <input
            id="customer-phone"
            type="tel"
            inputMode="numeric"
            placeholder="10-digit mobile"
            value={phone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            className="pm-field"
            autoComplete="tel"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="customer-name"
            className="block text-sm font-medium text-[var(--pm-on-surface)]"
          >
            Your name <span className="text-[var(--pm-secondary)]">*</span>
          </label>
          <input
            id="customer-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            className="pm-field"
            autoComplete="name"
          />
        </div>

        {customerInfo && (
          <p className="rounded-[var(--pm-radius-md)] bg-[var(--pm-primary-fixed)] px-3 py-2 text-sm text-[var(--pm-on-primary-fixed)]">
            Welcome back, {customerInfo.name}
          </p>
        )}

        {error && (
          <p className="rounded-[var(--pm-radius-md)] bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {showGeneralMenuLink && (
          <Link href={generalMenuHref} className="pm-btn-secondary w-full py-3">
            View menu instead
          </Link>
        )}

        <button type="submit" className="pm-btn-primary w-full py-3" disabled={pending}>
          {pending ? "Starting..." : "Continue"}
        </button>
      </form>
    </div>
  );
}
