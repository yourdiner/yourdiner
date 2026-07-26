"use client";

import { parsePaperWidthFromHtml } from "@/features/printing/render/thermal-receipt-css";
import type { PaperWidth } from "@/features/printing/types";

/**
 * Opens an HTML receipt in an off-screen iframe sized to thermal paper width,
 * then triggers the browser print dialog.
 */
export function browserPrintHtml(html: string, paperWidth?: PaperWidth): void {
  if (typeof window === "undefined") return;

  const width = paperWidth ?? parsePaperWidthFromHtml(html);
  const widthMm = `${width}mm`;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.setAttribute("title", "Print receipt");
  iframe.style.position = "fixed";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.width = widthMm;
  iframe.style.height = "100vh";
  iframe.style.border = "0";
  iframe.style.margin = "0";
  iframe.style.padding = "0";
  iframe.style.visibility = "hidden";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  const cleanup = () => {
    try {
      document.body.removeChild(iframe);
    } catch {
      /* ignore */
    }
  };

  const win = iframe.contentWindow;
  if (!win) {
    cleanup();
    return;
  }

  const runPrint = () => {
    const body = doc.body;
    if (body) {
      const contentHeight = Math.max(body.scrollHeight, body.offsetHeight, 400);
      iframe.style.height = `${contentHeight + 40}px`;
    }

    win.focus();
    try {
      win.print();
    } finally {
      setTimeout(cleanup, 1000);
    }
  };

  setTimeout(runPrint, 250);
}
