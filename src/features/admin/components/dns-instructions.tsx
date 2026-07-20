"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toTenantHostKey } from "@/lib/tenancy-keys";

type DomainStatus = "NONE" | "PENDING" | "ACTIVE" | string;

export function DnsInstructions({
  subdomain,
  uuid,
  customDomain,
  customDomainStatus,
  rootDomain,
}: {
  subdomain: string;
  uuid?: string;
  customDomain?: string | null;
  customDomainStatus?: DomainStatus | null;
  rootDomain?: string;
}) {
  const router = useRouter();
  const hostKey = uuid ? toTenantHostKey(uuid) : subdomain;
  const platformRoot = rootDomain || "yourdiner.in";
  const platformHost = `${hostKey}.${platformRoot}`;

  const [domain, setDomain] = useState(customDomain ?? "");
  const [loading, setLoading] = useState<"save" | "verify" | "clear" | null>(null);

  const status = customDomainStatus ?? "NONE";

  async function post(body: Record<string, unknown>) {
    const res = await fetch("/api/admin/custom-domain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json() as Promise<{ ok: boolean; error?: string; data?: unknown }>;
  }

  const saveDomain = async () => {
    setLoading("save");
    try {
      const result = await post({ domain });
      if (!result.ok) {
        toast.error(result.error ?? "Failed to save");
        return;
      }
      toast.success("Domain saved — point DNS, then verify");
      router.refresh();
    } finally {
      setLoading(null);
    }
  };

  const verifyDomain = async () => {
    setLoading("verify");
    try {
      const result = await post({ action: "verify" });
      if (!result.ok) {
        toast.error(result.error ?? "Verification failed");
        return;
      }
      toast.success("Custom domain is active");
      router.refresh();
    } finally {
      setLoading(null);
    }
  };

  const clearDomain = async () => {
    if (!confirm("Remove custom domain? Menu/QR/admin links will use the platform subdomain again.")) {
      return;
    }
    setLoading("clear");
    try {
      const result = await post({ action: "clear" });
      if (!result.ok) {
        toast.error(result.error ?? "Failed to clear");
        return;
      }
      setDomain("");
      toast.success("Custom domain removed");
      router.refresh();
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Platform subdomain (always works)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            Your POS keeps working on this host even if a custom domain fails. Use it as the
            fallback for admin, staff, menu, and QR.
          </p>
          <div className="rounded-lg bg-muted p-4 font-mono text-xs space-y-2">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Admin</span>
              <span className="text-right break-all">https://{platformHost}/admin</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Menu</span>
              <span className="text-right break-all">https://{platformHost}/menu</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Table QR</span>
              <span className="text-right break-all">
                https://{platformHost}/customer/table/{"{slug}"}
              </span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Copy each table&apos;s QR link from Tables — slugs are unique per table (not guessable
            T1/T2).
          </p>
          <p className="text-xs text-muted-foreground">
            DNS for the platform: CNAME <code>{hostKey}</code> → your VPS /{" "}
            <code>cname.vercel-dns.com</code> (or A record to the VPS IP).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Custom domain (optional)</CardTitle>
          {status !== "NONE" && (
            <Badge variant={status === "ACTIVE" ? "default" : "outline"}>{status}</Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            Use your own brand domain for menu, customer QR, and admin (e.g.{" "}
            <code>homecafe.in</code>). After it is <strong>ACTIVE</strong>, links and QR codes
            prefer this domain, and the platform subdomain redirects to it.
          </p>

          <div className="space-y-2">
            <Label htmlFor="custom-domain">Domain</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                id="custom-domain"
                placeholder="homecafe.in"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="max-w-sm"
              />
              <Button
                type="button"
                onClick={saveDomain}
                disabled={loading !== null || !domain.trim()}
              >
                {loading === "save" ? "Saving..." : "Save"}
              </Button>
              {customDomain ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={verifyDomain}
                  disabled={loading !== null}
                >
                  {loading === "verify" ? "Checking DNS..." : "Verify & activate"}
                </Button>
              ) : null}
              {customDomain ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={clearDomain}
                  disabled={loading !== null}
                >
                  {loading === "clear" ? "Removing..." : "Remove"}
                </Button>
              ) : null}
            </div>
          </div>

          {customDomain ? (
            <div className="rounded-lg bg-muted p-4 font-mono text-xs space-y-2">
              <p className="font-sans text-sm text-muted-foreground">
                Point DNS for <code>{customDomain}</code> to your Hostinger VPS (same server as{" "}
                {platformRoot}), then click Verify. Nginx must include this host and TLS.
              </p>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Type</span>
                <span>A or CNAME / ALIAS</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Name</span>
                <span>@ (or www)</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Target</span>
                <span>Your VPS IP / hostname</span>
              </div>
              {status === "ACTIVE" ? (
                <>
                  <div className="flex justify-between gap-4 pt-2">
                    <span className="text-muted-foreground">Menu</span>
                    <span className="text-right break-all">https://{customDomain}/menu</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Admin</span>
                    <span className="text-right break-all">https://{customDomain}/admin</span>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}

          <p className="text-xs text-muted-foreground">
            Tip: for admin login on the custom domain, prefer host-only session cookies (leave{" "}
            <code>COOKIE_DOMAIN</code> unset). Optional: set{" "}
            <code>CUSTOM_DOMAIN_EXPECTED_IP</code> on the server so Verify checks the A record.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
