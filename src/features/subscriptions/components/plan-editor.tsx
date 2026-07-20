"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updatePlanFeatures, updatePlanPricing, updatePlanMeta } from "@/features/subscriptions/platform-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface PlanEditorProps {
  plan: {
    id: string;
    name: string;
    description: string | null;
    displayOrder: number;
    isVisible: boolean;
    versions: Array<{
      id: string;
      versionNumber: number;
      trialDays: number;
      graceDays: number;
      planFeatures: Array<{ feature: { id: string; code: string; name: string }; enabled: boolean }>;
      pricing: Array<{ priceMonthly: number; priceYearly: number; currency: string; taxRate: number }>;
    }>;
  };
  features: Array<{ id: string; code: string; name: string }>;
}

export function PlanEditor({ plan, features }: PlanEditorProps) {
  const router = useRouter();
  const latest = plan.versions[0];
  const latestPricing = latest?.pricing[0];

  const [name, setName] = useState(plan.name);
  const [description, setDescription] = useState(plan.description ?? "");
  const [displayOrder, setDisplayOrder] = useState(plan.displayOrder);
  const [isVisible, setIsVisible] = useState(plan.isVisible);
  const [priceMonthly, setPriceMonthly] = useState(
    (latestPricing?.priceMonthly ?? 0) / 100
  );
  const [priceYearly, setPriceYearly] = useState((latestPricing?.priceYearly ?? 0) / 100);
  const [selectedFeatures, setSelectedFeatures] = useState<Set<string>>(() => {
    const enabled = latest?.planFeatures.filter((pf) => pf.enabled).map((pf) => pf.feature.code) ?? [];
    return new Set(enabled);
  });
  const [loading, setLoading] = useState(false);

  const toggleFeature = (code: string) => {
    setSelectedFeatures((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const saveMeta = async () => {
    setLoading(true);
    try {
      await updatePlanMeta({
        planId: plan.id,
        name,
        description,
        displayOrder,
        isVisible,
      });
      toast.success("Plan details saved");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const saveFeatures = async () => {
    setLoading(true);
    try {
      await updatePlanFeatures({
        planId: plan.id,
        featureCodes: Array.from(selectedFeatures),
        notes: "Updated via admin",
      });
      toast.success("New plan version created");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const savePricing = async () => {
    setLoading(true);
    try {
      await updatePlanPricing({
        planId: plan.id,
        priceMonthly: Math.round(priceMonthly * 100),
        priceYearly: Math.round(priceYearly * 100),
      });
      toast.success("Pricing updated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Plan Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Display Order</Label>
              <Input
                type="number"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(Number(e.target.value))}
              />
            </div>
            <div className="flex items-end gap-2 pb-2">
              <Checkbox checked={isVisible} onCheckedChange={(v) => setIsVisible(!!v)} />
              <Label>Visible to customers</Label>
            </div>
          </div>
          <Button onClick={saveMeta} disabled={loading}>
            Save Details
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Features (creates new version)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto">
            {features.map((feature) => (
              <label key={feature.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selectedFeatures.has(feature.code)}
                  onCheckedChange={() => toggleFeature(feature.code)}
                />
                {feature.name}
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Trial days and grace period are configured in Platform Settings.
          </p>
          <Button onClick={saveFeatures} disabled={loading}>
            Save Features
          </Button>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Pricing (creates new version when effective now)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Monthly (₹)</Label>
              <Input
                type="number"
                value={priceMonthly}
                onChange={(e) => setPriceMonthly(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Yearly (₹)</Label>
              <Input
                type="number"
                value={priceYearly}
                onChange={(e) => setPriceYearly(Number(e.target.value))}
              />
            </div>
          </div>
          {latest && (
            <p className="text-xs text-muted-foreground">
              Current version: v{latest.versionNumber}. Existing subscribers keep their locked version until renewal.
            </p>
          )}
          <Button onClick={savePricing} disabled={loading}>
            Save Pricing
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
