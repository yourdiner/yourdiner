"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, ExternalLink, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import {
  createUpgradeCheckout,
  fetchPendingCheckoutUrl,
  fetchSubscriptionStatus,
} from "@/lib/subscription-client";

type Phase = "idle" | "creating" | "opening" | "waiting" | "activated" | "error";

const STEPS: { key: Exclude<Phase, "idle" | "error">; label: string }[] = [
  { key: "creating", label: "Creating subscription…" },
  { key: "opening", label: "Opening Razorpay checkout…" },
  { key: "waiting", label: "Waiting for payment confirmation…" },
  { key: "activated", label: "Subscription activated" },
];

const PHASE_ORDER: Phase[] = ["creating", "opening", "waiting", "activated"];

export function UpgradeCheckoutButton({
  planSlug,
  billingCycle,
  label = "Upgrade",
  variant = "default",
  className,
  size,
  disabled,
  resume,
}: {
  planSlug: string;
  billingCycle: "MONTHLY" | "YEARLY";
  keyId?: string | null;
  label?: string;
  variant?: "default" | "secondary" | "outline";
  className?: string;
  size?: "default" | "sm" | "lg";
  disabled?: boolean;
  /**
   * When provided, the checkout resumes an already-created pending upgrade
   * instead of creating a new Razorpay subscription.
   */
  resume?: {
    checkoutUrl?: string | null;
    planName: string;
  };
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const pollingRef = useRef(false);

  const reset = useCallback(() => {
    pollingRef.current = false;
    setErrorMessage(null);
    setCheckoutUrl(null);
    setPhase("idle");
  }, []);

  const pollForActivation = useCallback(async () => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    setPhase("waiting");

    const deadline = Date.now() + 5 * 60_000;
    try {
      while (Date.now() < deadline && pollingRef.current) {
        await new Promise((r) => setTimeout(r, 3000));
        const status = await fetchSubscriptionStatus();
        if (
          status.ok &&
          status.active &&
          !status.pendingCheckout &&
          !status.pendingUpgradePlanId &&
          status.planSlug === planSlug
        ) {
          setPhase("activated");
          toast.success("Subscription activated");
          setTimeout(() => router.refresh(), 1500);
          return;
        }
      }
    } finally {
      pollingRef.current = false;
    }
  }, [planSlug, router]);

  const start = useCallback(async () => {
    setErrorMessage(null);

    // Open a blank tab synchronously inside the click handler so the browser
    // treats it as a user-initiated popup (survives popup blockers). We point
    // it at the real checkout URL once we have it.
    const checkoutWindow =
      typeof window !== "undefined" ? window.open("about:blank", "_blank") : null;

    setPhase("creating");
    try {
      let url: string | null = null;

      if (resume) {
        const pending = await fetchPendingCheckoutUrl();
        if (pending.ok) {
          url = pending.checkoutUrl;
        } else {
          url = resume.checkoutUrl ?? null;
        }
      }

      if (!url) {
        const result = await createUpgradeCheckout({ planSlug, billingCycle });
        if (!result.ok) {
          throw new Error(result.error);
        }
        url = result.checkoutUrl ?? null;
      }

      if (!url) {
        throw new Error(
          "Could not get the Razorpay checkout link. Please try again."
        );
      }

      setCheckoutUrl(url);
      setPhase("opening");

      if (checkoutWindow && !checkoutWindow.closed) {
        checkoutWindow.location.href = url;
      } else {
        // Popup was blocked — the dialog shows a manual link as a fallback.
        window.open(url, "_blank", "noopener,noreferrer");
      }

      void pollForActivation();
    } catch (error) {
      if (checkoutWindow && !checkoutWindow.closed) checkoutWindow.close();
      setErrorMessage(getErrorMessage(error));
      setPhase("error");
    }
  }, [planSlug, billingCycle, resume, pollForActivation]);

  const dialogOpen = phase !== "idle";

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        disabled={disabled || phase !== "idle"}
        onClick={start}
      >
        {label}
      </Button>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open && (phase === "activated" || phase === "error")) reset();
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {phase === "error"
                ? "Upgrade failed"
                : phase === "activated"
                  ? "All set!"
                  : "Completing your upgrade"}
            </DialogTitle>
          </DialogHeader>

          {phase === "error" ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
                <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <p>{errorMessage ?? "Something went wrong."}</p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={reset}>
                  Close
                </Button>
                <Button size="sm" onClick={start}>
                  Try again
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <ol className="space-y-3">
                {STEPS.map((step) => {
                  const currentIdx = PHASE_ORDER.indexOf(phase);
                  const stepIdx = PHASE_ORDER.indexOf(step.key);
                  const isDone = stepIdx < currentIdx || phase === "activated";
                  const isCurrent = step.key === phase && phase !== "activated";
                  const isActivatedStep = step.key === "activated";

                  return (
                    <li key={step.key} className="flex items-center gap-3 text-sm">
                      <span className="flex h-6 w-6 items-center justify-center">
                        {phase === "activated" && isActivatedStep ? (
                          <Check className="h-5 w-5 text-emerald-500" />
                        ) : isDone ? (
                          <Check className="h-4 w-4 text-emerald-500" />
                        ) : isCurrent ? (
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        ) : (
                          <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                        )}
                      </span>
                      <span
                        className={
                          isCurrent || (phase === "activated" && isActivatedStep)
                            ? "font-medium"
                            : "text-muted-foreground"
                        }
                      >
                        {step.label}
                      </span>
                    </li>
                  );
                })}
              </ol>

              {phase === "waiting" && checkoutUrl && (
                <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
                  <p>
                    Complete the payment in the Razorpay tab that just opened. This
                    page updates automatically once payment is confirmed.
                  </p>
                  <a
                    href={checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 font-medium text-primary hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Reopen payment page
                  </a>
                </div>
              )}

              {phase === "activated" && (
                <p className="text-center text-sm text-muted-foreground">
                  Updating your billing details…
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
