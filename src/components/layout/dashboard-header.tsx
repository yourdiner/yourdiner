"use client";

import { useState } from "react";
import { MaterialIcon } from "@/components/layout/material-icon";

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  createdAt: string;
}

interface DashboardHeaderProps {
  title: string;
  searchPlaceholder?: string;
  showSearch?: boolean;
  notifications?: NotificationItem[];
}

export function DashboardHeader({
  title,
  searchPlaceholder = "Search...",
  showSearch = true,
  notifications = [],
}: DashboardHeaderProps) {
  const [open, setOpen] = useState(false);
  const unreadCount = notifications.length;

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-tertiary-fixed bg-surface-bright px-margin-desktop">
      <div className="flex items-center gap-4">
        <h2 className="font-display text-headline-sm font-semibold text-primary">{title}</h2>
      </div>
      <div className="flex items-center gap-8">
        {showSearch && (
          <div className="relative hidden lg:block">
            <MaterialIcon
              name="search"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
            />
            <input
              className="w-64 border border-tertiary-fixed bg-surface py-2 pl-10 pr-4 text-label-sm outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder={searchPlaceholder}
              type="text"
            />
          </div>
        )}
        <div className="relative flex items-center gap-4 text-on-surface-variant">
          <button
            type="button"
            className="relative transition-colors hover:text-secondary"
            onClick={() => setOpen((v) => !v)}
          >
            <MaterialIcon name="notifications" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
          {open && notifications.length > 0 && (
            <div className="absolute right-0 top-12 z-50 w-80 rounded-lg border bg-card shadow-lg">
              <div className="max-h-80 overflow-y-auto p-2">
                {notifications.map((n) => (
                  <div key={n.id} className="border-b px-3 py-2 last:border-0">
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-muted-foreground">{n.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <button type="button" className="transition-colors hover:text-secondary">
            <MaterialIcon name="account_circle" className="text-3xl" />
          </button>
        </div>
      </div>
    </header>
  );
}
