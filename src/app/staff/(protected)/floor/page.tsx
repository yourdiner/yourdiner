import { getFloorTables } from "@/features/floor/queries";
import { FloorGridPoller } from "@/features/floor/components/floor-grid-poller";

export const dynamic = "force-dynamic";

export default async function StaffFloorPage() {
  const { tables, viewer } = await getFloorTables();

  return (
    <div className="bg-surface">
      <div className="mx-auto max-w-5xl px-4 pb-2 pt-6">
        <h1 className="font-display text-headline-sm font-semibold text-on-background">Floor Plan</h1>
        <p className="mt-1 text-on-surface-variant">
          Tap an available table to start a session, or open an active table to manage orders.
        </p>
      </div>
      <FloorGridPoller initialTables={tables} viewer={viewer} />
    </div>
  );
}
