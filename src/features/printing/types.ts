export type PrinterConnectionType = "BROWSER" | "LAN" | "USB" | "BLUETOOTH";
export type PaperWidth = "58" | "80";
export type PrinterRole = "billing" | "kitchen" | (string & {});

export type PrinterEndpointConfig = {
  enabled: boolean;
  name: string;
  connectionType: PrinterConnectionType;
  ipAddress?: string;
  port?: number;
  printAgentUrl?: string;
  paperWidth: PaperWidth;
  printLogo: boolean;
  header?: string;
  footerMessage?: string;
  autoCut: boolean;
  cashDrawerTrigger: boolean;
  copies: number;
};

export type PrinterSettings = {
  billingPrinter: PrinterEndpointConfig;
  kitchenPrinter: PrinterEndpointConfig;
  autoPrintKitchenTickets: boolean;
  autoPrintCustomerBills: boolean;
  /** Future: multi-station printers */
  printers?: PrinterEndpointConfig[];
};

export type BillLineSnapshot = {
  name: string;
  billDisplayName?: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  variantName?: string | null;
  modifiers: string[];
  notes?: string | null;
};

export type BillPaymentSnapshot = {
  method: string;
  amount: number;
  status: string;
};

export type BillSnapshot = {
  kind: "bill";
  restaurantName: string;
  logoUrl?: string | null;
  addressLines: string[];
  phone?: string | null;
  gstNumber?: string | null;
  header?: string | null;
  footerMessage?: string | null;
  orderNumber: number;
  invoiceLabel: string;
  orderType: string;
  tableLabel?: string | null;
  customerName?: string | null;
  waiterName?: string | null;
  printedAt: string;
  lines: BillLineSnapshot[];
  subtotal: number;
  promotionDiscountAmount: number;
  discountAmount: number;
  taxAmount: number;
  deliveryCharges: number;
  total: number;
  payments: BillPaymentSnapshot[];
  paidAmount: number;
  changeAmount: number;
  paperWidth: PaperWidth;
};

export type KotLineSnapshot = {
  name: string;
  quantity: number;
  variantName?: string | null;
  modifiers: string[];
  notes?: string | null;
  kitchenNotes?: string | null;
  status: string;
};

export type KotSnapshot = {
  kind: "kot";
  restaurantName: string;
  header?: string | null;
  footerMessage?: string | null;
  orderNumber: number;
  tableLabel?: string | null;
  waiterName?: string | null;
  printedAt: string;
  revisionNumber?: number | null;
  lines: KotLineSnapshot[];
  paperWidth: PaperWidth;
};

export type TestSnapshot = {
  kind: "test";
  restaurantName: string;
  printerName: string;
  connectionType: PrinterConnectionType;
  paperWidth: PaperWidth;
  printedAt: string;
  header?: string | null;
  footerMessage?: string | null;
};

export type PrintSnapshot = BillSnapshot | KotSnapshot | TestSnapshot;

export type PrintResult = {
  ok: boolean;
  mode: "browser" | "agent" | "stub";
  html?: string;
  escPosBase64?: string;
  errorMessage?: string;
  agentStatus?: string;
};

export type PrinterProviderId = "browser" | "lan_agent" | "usb" | "bluetooth";

export interface PrinterProvider {
  id: PrinterProviderId;
  print(input: {
    restaurantId: string;
    endpoint: PrinterEndpointConfig;
    snapshot: PrintSnapshot;
    html: string;
    escPosBase64: string;
  }): Promise<PrintResult>;
}
