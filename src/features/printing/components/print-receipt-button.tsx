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
import {
  BrowserPrintGuidance,
  markThermalPrintGuidanceSeen,
} from "@/features/printing/components/browser-print-guidance";
import type { PaperWidth } from "@/features/printing/types";

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
  const [paperWidth, setPaperWidth] = useState<PaperWidth>("80");
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
      setPaperWidth(result.paperWidth);
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
        markThermalPrintGuidanceSeen();
        browserPrintHtml(result.result.html, paperWidth);
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

  const previewWidthPx = paperWidth === "58" ? 220 : 302;

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
        <DialogContent className="max-w-lg gap-4">
          <DialogHeader>
            <DialogTitle>
              {kind === "bill" ? "Bill preview" : "Kitchen ticket preview"}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({paperWidth}mm)
              </span>
            </DialogTitle>
          </DialogHeader>

          <BrowserPrintGuidance paperWidth={paperWidth} />

          <div className="flex max-h-[55vh] justify-center overflow-auto rounded-md bg-neutral-200/80 p-4">
            {html ? (
              <div
                className="overflow-hidden rounded-sm bg-white shadow-none"
                style={{ width: previewWidthPx, maxWidth: `${paperWidth}mm` }}
              >
                <iframe
                  title="Receipt preview"
                  srcDoc={html}
                  className="block border-0"
                  style={{
                    width: previewWidthPx,
                    height: 480,
                    maxWidth: `${paperWidth}mm`,
                  }}
                />
              </div>
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
