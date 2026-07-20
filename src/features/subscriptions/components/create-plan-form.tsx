"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPlan } from "@/features/subscriptions/platform-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RequiredLabel } from "@/components/ui/required-label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import Link from "next/link";

const DEFAULT_FEATURES = ["qr_menu"];

export function CreatePlanForm({
  features,
}: {
  features: Array<{ code: string; name: string }>;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [priceMonthly, setPriceMonthly] = useState(499);
  const [priceYearly, setPriceYearly] = useState(4990);
  const [selected, setSelected] = useState<Set<string>>(new Set(DEFAULT_FEATURES));

  const submit = async () => {
    setLoading(true);
    try {
      const plan = await createPlan({
        name,
        slug,
        description,
        featureCodes: Array.from(selected),
        priceMonthly: Math.round(priceMonthly * 100),
        priceYearly: Math.round(priceYearly * 100),
      });
      toast.success("Plan created");
      router.push(`/platform/plans/${plan.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>New Plan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <RequiredLabel>Name</RequiredLabel>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <RequiredLabel>Slug</RequiredLabel>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <RequiredLabel>Monthly (₹)</RequiredLabel>
            <Input
              type="number"
              value={priceMonthly}
              onChange={(e) => setPriceMonthly(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <RequiredLabel>Yearly (₹)</RequiredLabel>
            <Input
              type="number"
              value={priceYearly}
              onChange={(e) => setPriceYearly(Number(e.target.value))}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {features.map((f) => (
            <label key={f.code} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={selected.has(f.code)}
                onCheckedChange={() =>
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (next.has(f.code)) next.delete(f.code);
                    else next.add(f.code);
                    return next;
                  })
                }
              />
              {f.name}
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <Button onClick={submit} disabled={loading || !name || !slug}>
            Create Plan
          </Button>
          <Link href="/platform/plans">
            <Button variant="outline">Cancel</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
