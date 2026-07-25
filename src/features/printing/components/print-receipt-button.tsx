"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  previewBillAction,
  previewKotAction,
  printBillAction,
  printKotAction,
} from "@/features/printing/actions";
import { browserPrintHtml } from "@/features/printing/browser-print";

type Props = {
  orderId: string;
  kind: "bill" | "kot";
  revisionNumber?: number;
  diningSessionId?: string;
  triggerLabel?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
};

export function PrintReceiptButton({
  orderId,
  kind,
  revisionNumber,
  diningSessionId,
  triggerLabel,
  variant = "outline",
  size = "sm",
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [html, setHtml] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function loadPreview() {
    startTransition(async () => {
      const result =
        kind === "bill"
          ? await previewBillAction(orderId)
          : await previewKotAction(orderId, revisionNumber);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setHtml(result.html);
      setOpen(true);
    });
  }

  function doPrint() {
    startTransition(async () => {
      const result =
        kind === "bill"
          ? await printBillAction(orderId, diningSessionId)
          : await printKotAction(orderId, revisionNumber);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      if (result.result.needsBrowserPrint && result.result.html) {
        browserPrintHtml(result.result.html);
        toast.success(kind === "bill" ? "Bill sent to printer" : "KOT sent to printer");
        setOpen(false);
        return;
      }

      if (result.result.status === "FAILED") {
        toast.error(result.result.errorMessage || "Printing failed. Retry?");
        return;
      }

      toast.success(kind === "bill" ? "Bill printed" : "KOT printed");
      setOpen(false);
    });
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        disabled={pending}
        onClick={loadPreview}
      >
        {triggerLabel || (kind === "bill" ? "Print bill" : "Print KOT")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{kind === "bill" ? "Bill preview" : "Kitchen ticket preview"}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto rounded-md border bg-white p-2">
            {html ? (
              <iframe
                title="Receipt preview"
                srcDoc={html}
                className="h-[480px] w-full border-0"
              />
            ) : (
              <p className="p-4 text-sm text-muted-foreground">Loading…</p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button type="button" disabled={pending || !html} onClick={doPrint}>
              {pending ? "Printing…" : "Print"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
