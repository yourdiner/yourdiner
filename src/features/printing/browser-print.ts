"use client";

/**
 * Opens an HTML receipt in a hidden iframe and triggers the browser print dialog.
 * Never blocks the caller beyond the print invocation.
 */
export function browserPrintHtml(html: string): void {
  if (typeof window === "undefined") return;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
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

  win.focus();
  setTimeout(() => {
    try {
      win.print();
    } finally {
      setTimeout(cleanup, 1000);
    }
  }, 250);
}
