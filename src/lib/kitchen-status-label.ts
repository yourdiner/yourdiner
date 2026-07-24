/** Human labels for OrderItemKitchenStatus (DB SENT = kitchen "Pending"). */
export function formatKitchenStatusLabel(status: string): string {
  switch (status) {
    case "PENDING":
      return "Draft";
    case "SENT":
      return "Pending";
    case "PREPARING":
      return "Preparing";
    case "READY":
      return "Ready";
    case "SERVED":
      return "Served";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status.toLowerCase().replace(/_/g, " ");
  }
}

export function kitchenStatusBadgeClass(status: string): string {
  switch (status) {
    case "SENT":
      return "bg-amber-50 text-amber-800 ring-amber-200/80";
    case "PREPARING":
      return "bg-sky-50 text-sky-800 ring-sky-200/80";
    case "READY":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200/80";
    case "SERVED":
      return "bg-zinc-100 text-zinc-600 ring-zinc-200/80";
    case "CANCELLED":
      return "bg-red-50 text-red-700 ring-red-200/80";
    case "PENDING":
      return "bg-zinc-50 text-zinc-500 ring-zinc-200/80";
    default:
      return "bg-zinc-50 text-zinc-600 ring-zinc-200/80";
  }
}
