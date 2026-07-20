"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { formatCurrency, rupeesToPaise } from "@/lib/utils";

type VariantRow = {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
  groupId?: string | null;
};

type VariantGroupRow = {
  id: string;
  name: string;
  isRequired: boolean;
  variants: VariantRow[];
};

interface VariantGroupsEditorProps {
  productId: string;
  variantGroups: VariantGroupRow[];
  legacyVariants?: VariantRow[];
}

async function apiPost(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<{ ok: boolean; error?: string }>;
}

async function apiDelete(url: string) {
  const res = await fetch(url, { method: "DELETE" });
  return res.json() as Promise<{ ok: boolean; error?: string }>;
}

export function VariantGroupsEditor({
  productId,
  variantGroups,
  legacyVariants = [],
}: VariantGroupsEditorProps) {
  const router = useRouter();
  const [groupName, setGroupName] = useState("Size");
  const [optionName, setOptionName] = useState("");
  const [optionPrice, setOptionPrice] = useState(0);
  const [activeGroupId, setActiveGroupId] = useState(variantGroups[0]?.id ?? "");

  const groups =
    variantGroups.length > 0
      ? variantGroups
      : legacyVariants.length > 0
        ? [
            {
              id: "__legacy__",
              name: "Options",
              isRequired: true,
              variants: legacyVariants,
            },
          ]
        : [];

  const refresh = () => router.refresh();

  const addGroup = async () => {
    const result = await apiPost(`/api/admin/products/${productId}/variant-groups`, {
      name: groupName,
      isRequired: true,
    });
    if (!result.ok) {
      toast.error(result.error ?? "Failed");
      return;
    }
    toast.success("Variant group added");
    refresh();
  };

  const addOption = async (groupId?: string) => {
    if (!optionName) return;
    const result = await apiPost(`/api/admin/products/${productId}/variants`, {
      name: optionName,
      price: rupeesToPaise(optionPrice),
      groupId: groupId && groupId !== "__legacy__" ? groupId : undefined,
    });
    if (!result.ok) {
      toast.error(result.error ?? "Failed");
      return;
    }
    setOptionName("");
    setOptionPrice(0);
    toast.success("Variant added");
    refresh();
  };

  const removeVariant = async (variantId: string) => {
    const result = await apiDelete(`/api/admin/products/variants/${variantId}`);
    if (!result.ok) {
      toast.error(result.error ?? "Failed");
      return;
    }
    toast.success("Variant removed");
    refresh();
  };

  const removeGroup = async (groupId: string) => {
    if (!confirm("Delete this variant group and all its options?")) return;
    const result = await apiDelete(
      `/api/admin/products/${productId}/variant-groups/${groupId}`
    );
    if (!result.ok) {
      toast.error(result.error ?? "Failed");
      return;
    }
    toast.success("Variant group removed");
    refresh();
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Variant prices are absolute — they replace the base product price when selected.
        Base price is used when no variants exist.
      </p>

      {groups.map((group) => (
        <div key={group.id} className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-semibold">{group.name}</p>
              <p className="text-xs text-muted-foreground">
                {group.isRequired ? "Required — customer must choose one" : "Optional"}
              </p>
            </div>
            {group.id !== "__legacy__" && (
              <Button type="button" variant="ghost" size="icon" onClick={() => removeGroup(group.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
          {group.variants.map((v) => (
            <div key={v.id} className="flex items-center gap-3 rounded-md bg-muted/40 px-3 py-2">
              <span className="flex-1 font-medium">{v.name}</span>
              <span className="text-sm">{formatCurrency(v.price)}</span>
              <Button type="button" variant="ghost" size="icon" onClick={() => removeVariant(v.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Option name"
              value={activeGroupId === group.id ? optionName : ""}
              onFocus={() => setActiveGroupId(group.id)}
              onChange={(e) => {
                setActiveGroupId(group.id);
                setOptionName(e.target.value);
              }}
              className="max-w-[160px]"
            />
            <Input
              type="number"
              step="0.01"
              placeholder="Price ₹"
              value={activeGroupId === group.id ? optionPrice : 0}
              onFocus={() => setActiveGroupId(group.id)}
              onChange={(e) => {
                setActiveGroupId(group.id);
                setOptionPrice(parseFloat(e.target.value) || 0);
              }}
              className="w-28"
            />
            <Button type="button" size="sm" onClick={() => addOption(group.id)}>
              <Plus className="h-4 w-4" />
              Add Variant
            </Button>
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-end gap-2 border-t pt-4">
        <div className="space-y-1">
          <Label>New variant group</Label>
          <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} className="w-40" />
        </div>
        <Button type="button" variant="outline" onClick={addGroup}>
          <Plus className="mr-1 h-4 w-4" />
          Add Variant Group
        </Button>
      </div>
    </div>
  );
}
