"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateRestaurantSettings } from "@/lib/settings-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface SettingsFormProps {
  restaurant: {
    name: string;
    subdomain: string;
    settings: {
      language: string;
      currency: string;
      timezone: string;
    } | null;
  };
}

export function SettingsForm({ restaurant }: SettingsFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: restaurant.name,
    language: restaurant.settings?.language || "en",
    currency: restaurant.settings?.currency || "INR",
    timezone: restaurant.settings?.timezone || "Asia/Kolkata",
  });

  const handleSave = async () => {
    setLoading(true);
    try {
      const result = await updateRestaurantSettings(form);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Settings saved");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Restaurant Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Restaurant Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Subdomain</Label>
            <Input value={restaurant.subdomain} disabled />
            <p className="text-xs text-muted-foreground">Subdomain cannot be changed after creation</p>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Language</Label>
              <Input value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
            </div>
          </div>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save Settings"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
