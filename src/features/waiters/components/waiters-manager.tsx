"use client";

import { useState, useTransition } from "react";
import { useServerSyncedState } from "@/hooks/use-server-synced-state";
import { useRouter } from "next/navigation";
import { createWaiter, deactivateWaiter, updateWaiter } from "@/lib/waiter-client";
import { DEFAULT_STAFF_PASSWORD } from "@/lib/staff-auth-constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RequiredLabel } from "@/components/ui/required-label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";

type Waiter = {
  id: string;
  displayName: string;
  mobile: string | null;
  employeeId: string | null;
  role: string;
  isActive: boolean;
  joiningDate: Date | null;
  mustChangePassword?: boolean;
  _count: { assignedDiningSessions: number };
};

export function WaitersManager({ waiters: initial }: { waiters: Waiter[] }) {
  const router = useRouter();
  const [waiters, setWaiters] = useServerSyncedState(initial);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [resetPassword, setResetPassword] = useState(false);
  const [pending, startTransition] = useTransition();

  const editing = waiters.find((w) => w.id === editId);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError("");
    const fd = new FormData(e.currentTarget);
    const payload = {
      displayName: String(fd.get("displayName")),
      mobile: String(fd.get("mobile")),
      employeeId: String(fd.get("employeeId") || "").trim() || undefined,
      role: String(fd.get("role") || "STAFF") as "STAFF",
      joiningDate: String(fd.get("joiningDate") || "") || undefined,
      isActive: editId ? fd.get("isActive") === "on" : true,
      resetPassword: editId ? resetPassword : undefined,
    };

    startTransition(async () => {
      if (editId) {
        const result = await updateWaiter(editId, payload);
        if (!result.ok) {
          setFormError(result.error);
          toast.error(result.error);
          return;
        }
        if (result.data?.defaultPassword) {
          toast.success(`Password reset to ${result.data.defaultPassword}`);
        } else {
          toast.success("Staff updated");
        }
      } else {
        const result = await createWaiter(payload);
        if (!result.ok) {
          setFormError(result.error);
          toast.error(result.error);
          return;
        }
        const pwd = result.data?.defaultPassword ?? DEFAULT_STAFF_PASSWORD;
        toast.success(`Staff added. Default password: ${pwd}`);
      }
      setOpen(false);
      setEditId(null);
      setResetPassword(false);
      setFormError("");
      router.refresh();
    });
  }

  function deactivate(id: string) {
    startTransition(async () => {
      const result = await deactivateWaiter(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setWaiters((prev) => prev.map((w) => (w.id === id ? { ...w, isActive: false } : w)));
      toast.success("Staff deactivated");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Waiters</h1>
          <p className="text-sm text-muted-foreground">
            Waiters sign in with mobile + password. New accounts get temporary password{" "}
            <span className="font-mono">{DEFAULT_STAFF_PASSWORD}</span> and must change it on
            first login.
          </p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) {
              setEditId(null);
              setFormError("");
              setResetPassword(false);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                setEditId(null);
                setResetPassword(false);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add waiter
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editId ? "Edit waiter" : "New waiter"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <RequiredLabel htmlFor="displayName">Display name</RequiredLabel>
                <Input
                  id="displayName"
                  name="displayName"
                  defaultValue={editing?.displayName}
                  required
                />
              </div>
              <div className="space-y-2">
                <RequiredLabel htmlFor="mobile">Mobile</RequiredLabel>
                <Input
                  id="mobile"
                  name="mobile"
                  defaultValue={editing?.mobile ?? ""}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employeeId">Employee ID</Label>
                <Input id="employeeId" name="employeeId" defaultValue={editing?.employeeId ?? ""} />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">Waiter</p>
                <input type="hidden" name="role" value="STAFF" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="joiningDate">Joining date</Label>
                <Input
                  id="joiningDate"
                  name="joiningDate"
                  type="date"
                  defaultValue={
                    editing?.joiningDate
                      ? new Date(editing.joiningDate).toISOString().slice(0, 10)
                      : ""
                  }
                />
              </div>
              {editId ? (
                <>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="isActive" defaultChecked={editing?.isActive} />
                    Active
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={resetPassword}
                      onChange={(e) => setResetPassword(e.target.checked)}
                    />
                    Reset password to {DEFAULT_STAFF_PASSWORD}
                  </label>
                </>
              ) : (
                <p className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
                  Temporary password: <span className="font-mono font-medium">{DEFAULT_STAFF_PASSWORD}</span>
                  . Staff must create a new password after first sign-in.
                </p>
              )}
              {formError && (
                <p className="text-sm text-destructive" role="alert">
                  {formError}
                </p>
              )}
              <Button type="submit" disabled={pending} className="w-full">
                {pending ? "Saving…" : "Save"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {waiters.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="font-medium">No waiters yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add waiters so they can sign in to the staff POS and take table orders.
          </p>
          <Button
            className="mt-4"
            onClick={() => {
              setEditId(null);
              setOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add your first waiter
          </Button>
        </div>
      ) : (
        <div className="divide-y rounded-lg border">
          {waiters.map((w) => (
            <div key={w.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
              <span className="min-w-[120px] flex-1 font-medium">{w.displayName}</span>
              <span className="text-muted-foreground">{w.mobile ?? "—"}</span>
              <span>Waiter</span>
              <span>{w._count.assignedDiningSessions} sessions</span>
              <Badge variant={w.isActive ? "default" : "secondary"}>
                {w.isActive ? "Active" : "Inactive"}
              </Badge>
              {w.mustChangePassword && (
                <Badge variant="outline">Must change password</Badge>
              )}
              <div className="ml-auto flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setEditId(w.id);
                    setFormError("");
                    setResetPassword(false);
                    setOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                {w.isActive && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deactivate(w.id)}
                    disabled={pending}
                  >
                    Deactivate
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
