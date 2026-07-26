import type { PaperWidth } from "../types";

/**
 * Shared thermal receipt CSS for browser print and future USB/LAN HTML payloads.
 * Paper width comes from restaurant printer settings (58 | 80).
 */
export function buildThermalReceiptCss(paperWidth: PaperWidth): string {
  const mm = paperWidth === "58" ? "58" : "80";

  return `
    @page {
      size: ${mm}mm auto;
      margin: 0;
    }

    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      display: flex;
      justify-content: center;
      width: ${mm}mm;
    }

    .receipt {
      width: ${mm}mm;
      max-width: ${mm}mm;
      margin: 0 auto;
      padding: 4mm;
      box-shadow: none;
      background: #fff;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Courier New", monospace;
      font-size: 11px;
      line-height: 1.35;
      color: #111;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .receipt * {
      box-sizing: border-box;
    }

    .center { text-align: center; }
    .bold { font-weight: 700; }
    .muted { color: #555; font-size: 10px; }

    .row {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .hr {
      border: 0;
      border-top: 1px dashed #999;
      margin: 8px 0;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .item {
      margin: 6px 0;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .totals {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .indent {
      padding-left: 12px;
      color: #444;
      font-size: 10px;
    }

    .logo {
      max-width: 64px;
      max-height: 64px;
      margin: 0 auto 6px;
      display: block;
    }

    @media print {
      html, body {
        width: ${mm}mm;
        margin: 0;
        padding: 0;
        background: #fff;
      }

      .receipt {
        width: ${mm}mm;
        max-width: ${mm}mm;
        margin: 0;
        padding: 4mm;
        box-shadow: none;
        background: #fff;
      }

      .no-print {
        display: none !important;
      }
    }
  `;
}

/** Parse paper width from rendered receipt HTML (data-paper-width or @page size). */
export function parsePaperWidthFromHtml(html: string): PaperWidth {
  const dataMatch = html.match(/data-paper-width=["']?(58|80)["']?/);
  if (dataMatch?.[1] === "58" || dataMatch?.[1] === "80") {
    return dataMatch[1];
  }
  const pageMatch = html.match(/size:\s*(58|80)mm/);
  if (pageMatch?.[1] === "58" || pageMatch?.[1] === "80") {
    return pageMatch[1];
  }
  return "80";
}
