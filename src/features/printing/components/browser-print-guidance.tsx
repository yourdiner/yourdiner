"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { PaperWidth } from "@/features/printing/types";

export const THERMAL_PRINT_GUIDANCE_KEY = "thermal-browser-print-guidance-v1";

export function markThermalPrintGuidanceSeen(): void {
  try {
    localStorage.setItem(THERMAL_PRINT_GUIDANCE_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function BrowserPrintGuidance({
  paperWidth,
  onDismiss,
}: {
  paperWidth: PaperWidth;
  onDismiss?: () => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(localStorage.getItem(THERMAL_PRINT_GUIDANCE_KEY) !== "1");
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  function dismiss() {
    markThermalPrintGuidanceSeen();
    setVisible(false);
    onDismiss?.();
  }

  return (
    <div className="no-print rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
      <p className="mb-2 font-semibold">Browser print settings (first time)</p>
      <ul className="mb-3 space-y-1 text-xs leading-relaxed text-amber-900/90">
        <li>
          <span className="font-medium">Paper Size:</span> {paperWidth}mm Receipt
        </li>
        <li>
          <span className="font-medium">Margins:</span> None
        </li>
        <li>
          <span className="font-medium">Scale:</span> 100%
        </li>
        <li>
          <span className="font-medium">Headers &amp; Footers:</span> Off
        </li>
        <li>
          <span className="font-medium">Background Graphics:</span> Off
        </li>
      </ul>
      <Button type="button" size="sm" variant="outline" onClick={dismiss}>
        Got it
      </Button>
    </div>
  );
}
