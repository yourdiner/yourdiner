"use client";

import { useState, useEffect } from "react";
import { Wrench, User, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type DevUser = {
  id: string;
  label: string;
  email: string;
  role: string;
  redirectUrl: string;
  loginUrl: string;
  tenantHost?: string;
  description?: string;
};

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  OWNER: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  MANAGER: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  STAFF: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  KITCHEN: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  CASHIER: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
  CUSTOMER: "bg-pink-500/15 text-pink-700 dark:text-pink-300",
};

export function DevTools() {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<DevUser[]>([]);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    // Avoid 404 noise in production builds where /api/dev/users is disabled.
    if (process.env.NODE_ENV === "production") return;

    fetch("/api/dev/users")
      .then((res) => {
        if (res.ok) {
          setEnabled(true);
          return res.json();
        }
        return null;
      })
      .then((data) => {
        if (data?.users) setUsers(data.users);
      })
      .catch(() => setEnabled(false));
  }, []);

  if (!enabled) return null;

  const handleImpersonate = (user: DevUser) => {
    if (!user.loginUrl) {
      toast.error("Missing login URL — re-run npm run db:seed");
      return;
    }

    setLoading(user.id);
    toast.success(`Signing in as ${user.label} on ${user.tenantHost || "platform"}...`);
    setOpen(false);
    window.location.assign(user.loginUrl);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-[9999] flex h-12 w-12 items-center justify-center rounded-full bg-amber-500 text-white shadow-lg hover:bg-amber-600 transition-colors"
        title="Dev Tools"
        aria-label="Open Dev Tools"
      >
        <Wrench className="h-5 w-5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-amber-500" />
              Dev Tools
            </DialogTitle>
            <DialogDescription>
              Signs in on each user&apos;s subdomain with their demo email and password.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {users.map((user) => (
              <button
                key={user.id}
                onClick={() => handleImpersonate(user)}
                disabled={loading !== null}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                  "hover:bg-muted/80 disabled:opacity-50"
                )}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                  {loading === user.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <User className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{user.label}</span>
                    <Badge
                      variant="outline"
                      className={cn("text-[10px]", ROLE_COLORS[user.role])}
                    >
                      {user.role.replace("_", " ")}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {user.tenantHost ? `${user.tenantHost} · ` : ""}
                    {user.email}
                  </p>
                </div>
              </button>
            ))}

            {users.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">
                No dev users found. Run <code className="text-xs">npm run db:seed</code>
              </p>
            )}
          </div>

          <p className="text-[10px] text-muted-foreground text-center">
            Password: Dev@123456 · Hidden in production
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
