"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RequiredLabel } from "@/components/ui/required-label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Utensils } from "lucide-react";

export function StaffLoginForm({ restaurantName }: { restaurantName: string }) {
  const router = useRouter();
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, password }),
      });

      const result = (await response.json()) as {
        ok: boolean;
        error?: string;
        mustChangePassword?: boolean;
      };

      if (!response.ok || !result.ok) {
        setError(result.error ?? "Invalid mobile or password");
        return;
      }

      if (result.mustChangePassword) {
        router.push("/staff/change-password");
      } else {
        router.push("/staff/floor");
      }
      router.refresh();
    } catch {
      setError("Could not sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Utensils className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>{restaurantName}</CardTitle>
          <CardDescription>Staff login — mobile & password</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <RequiredLabel htmlFor="mobile">Mobile</RequiredLabel>
              <Input
                id="mobile"
                type="tel"
                inputMode="numeric"
                placeholder="9876543210"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                autoComplete="tel"
                required
              />
            </div>
            <div className="space-y-2">
              <RequiredLabel htmlFor="password">Password</RequiredLabel>
              <Input
                id="password"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <p className="text-xs text-muted-foreground">
                New accounts use the default password from your manager. You will be asked to change
                it after first login.
              </p>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
