export interface DayPhase {
  id: string;
  time: string;
  title: string;
  beats: string[];
}

export const DAY_PHASES: DayPhase[] = [
  {
    id: "morning",
    time: "Morning",
    title: "Reservations land before the first guest walks in.",
    beats: [
      "Tables are pre-assigned from last night's holds",
      "Staff see the day on one shared floor view",
      "No phone tag between host and manager",
    ],
  },
  {
    id: "lunch",
    time: "Lunch rush",
    title: "The room fills. Orders never get lost.",
    beats: [
      "Waiters fire tickets from their phones",
      "Kitchen display sorts by course and table",
      "Guests scan QR and reorder without flagging staff",
    ],
  },
  {
    id: "evening",
    time: "Evening",
    title: "Revenue updates while service is still running.",
    beats: [
      "Live floor shows occupied vs ready to turn",
      "Takeaway and delivery run beside dine-in",
      "Analytics reflect tonight, not last week",
    ],
  },
  {
    id: "closing",
    time: "Closing",
    title: "Bills settle. Tomorrow is already prepared.",
    beats: [
      "Split checks and GST invoices in seconds",
      "Customer profiles grow with every visit",
      "Reservations for tomorrow are already on the books",
    ],
  },
];

export interface FloorZone {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  headline: string;
  detail: string;
}

export const FLOOR_ZONES: FloorZone[] = [
  {
    id: "tables",
    label: "Dining room",
    x: 8,
    y: 12,
    w: 52,
    h: 48,
    headline: "Every table, live.",
    detail:
      "See occupancy, session totals, and turn time at a glance. Staff start sessions from the floor, not from memory.",
  },
  {
    id: "kitchen",
    label: "Kitchen",
    x: 64,
    y: 8,
    w: 28,
    h: 36,
    headline: "Tickets that never vanish.",
    detail:
      "Kitchen display routes orders by station. Fired, ready, and recalled items stay visible until served.",
  },
  {
    id: "counter",
    label: "Counter",
    x: 64,
    y: 48,
    w: 28,
    h: 28,
    headline: "Billing without the scramble.",
    detail:
      "Settle dine-in, split bills, apply discounts, and print GST-ready invoices from one counter flow.",
  },
  {
    id: "takeaway",
    label: "Takeaway",
    x: 8,
    y: 64,
    w: 24,
    h: 24,
    headline: "Pickup without a second system.",
    detail:
      "Takeaway orders share the same kitchen queue and customer database as dine-in.",
  },
  {
    id: "delivery",
    label: "Delivery",
    x: 36,
    y: 64,
    w: 24,
    h: 24,
    headline: "Delivery tracked in one place.",
    detail:
      "Route delivery orders through the same ops stack with status, rider notes, and payment in sync.",
  },
];

export interface ProductScreen {
  id: string;
  label: string;
  title: string;
  description: string;
}

export const PRODUCT_SCREENS: ProductScreen[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    title: "The pulse of tonight",
    description: "Revenue, active orders, and floor health on one calm home screen.",
  },
  {
    id: "orders",
    label: "Orders",
    title: "Every channel, one queue",
    description: "Dine-in, takeaway, and delivery orders filtered without switching tools.",
  },
  {
    id: "kitchen",
    label: "Kitchen",
    title: "Line of sight for the line",
    description: "Course-aware tickets with timers that keep peak hour under control.",
  },
  {
    id: "reservations",
    label: "Reservations",
    title: "Books that respect your floor",
    description: "Assign tables, manage holds, and cut no-shows before guests arrive.",
  },
  {
    id: "analytics",
    label: "Analytics",
    title: "Decisions from real shifts",
    description: "Best sellers, peak hours, and repeat guests without exporting spreadsheets.",
  },
];

export interface PainPoint {
  id: string;
  label: string;
  cost: string;
}

export const PAIN_POINTS: PainPoint[] = [
  { id: "wait", label: "Guests waiting to order", cost: "Tables turn slower" },
  { id: "wrong", label: "Wrong orders reaching tables", cost: "Waste and refunds" },
  { id: "phone", label: "Phone ringing off the hook", cost: "Staff pulled off floor" },
  { id: "billing", label: "Manual billing at close", cost: "Errors and delays" },
  { id: "paper", label: "Paper reservation books", cost: "Double bookings" },
  { id: "lost", label: "Guests who never return", cost: "Revenue walks out" },
];

export interface FlowStep {
  id: string;
  title: string;
  description: string;
}

export const FLOW_STEPS: FlowStep[] = [
  {
    id: "reserve",
    title: "Reservation confirmed",
    description: "Table held, party size captured, reminders sent automatically.",
  },
  {
    id: "assign",
    title: "Table assigned",
    description: "Host seats the party with the floor already in sync.",
  },
  {
    id: "session",
    title: "Waiter starts session",
    description: "Orders attach to the table session, not a scribbled ticket.",
  },
  {
    id: "kitchen",
    title: "Kitchen receives order",
    description: "Tickets route to the right station with modifiers intact.",
  },
  {
    id: "ready",
    title: "Food ready",
    description: "Expo marks ready; floor knows what to run and when.",
  },
  {
    id: "bill",
    title: "Bill generated",
    description: "Split, discount, or settle in one flow with GST ready.",
  },
  {
    id: "return",
    title: "Guest returns",
    description: "Profile, preferences, and visit history bring them back.",
  },
];
