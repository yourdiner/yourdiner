"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateBrandSettings } from "@/features/platform/settings-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RequiredLabel } from "@/components/ui/required-label";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface BrandSettingsFormProps {
  brandName: string;
  brandLogo: string | null;
}

export function BrandSettingsForm({
  brandName: initialName,
  brandLogo: initialLogo,
}: BrandSettingsFormProps) {
  const router = useRouter();
  const [brandName, setBrandName] = useState(initialName);
  const [brandLogo, setBrandLogo] = useState(initialLogo ?? "");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateBrandSettings({ brandName, brandLogo });
      toast.success("Brand settings saved");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Brand</CardTitle>
        <CardDescription>
          Your platform name and logo. This appears across the admin panel, restaurant
          dashboards, staff pages, and customer menus (shown as &ldquo;{brandName || "Your Brand"} by
          BluePeak Studio&rdquo;).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <RequiredLabel htmlFor="brandName">Brand name</RequiredLabel>
            <Input
              id="brandName"
              value={brandName}
              maxLength={60}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="Restaurant OS"
            />
          </div>
          <div className="space-y-2">
            <RequiredLabel htmlFor="brandLogo" required={false}>
              Logo URL
            </RequiredLabel>
            <Input
              id="brandLogo"
              value={brandLogo}
              onChange={(e) => setBrandLogo(e.target.value)}
              placeholder="https://.../logo.png"
            />
          </div>
        </div>

        {brandLogo ? (
          <div className="space-y-2">
            <Label>Preview</Label>
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={brandLogo} alt="Brand logo preview" className="h-full w-full object-contain" />
            </div>
          </div>
        ) : null}

        <Button onClick={handleSave} disabled={loading}>
          {loading ? "Saving..." : "Save brand settings"}
        </Button>
      </CardContent>
    </Card>
  );
}
