"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { formatCurrency, rupeesToPaise } from "@/lib/utils";

type ModifierRow = { id: string; name: string; price: number };
type LinkedGroup = {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  isRequired: boolean;
  modifiers: ModifierRow[];
};

interface ModifierGroupsEditorProps {
  productId: string;
  linkedGroups: LinkedGroup[];
  availableGroups: LinkedGroup[];
}

async function apiPost(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : "{}",
  });
  return res.json() as Promise<{ ok: boolean; error?: string }>;
}

async function apiDelete(url: string) {
  const res = await fetch(url, { method: "DELETE" });
  return res.json() as Promise<{ ok: boolean; error?: string }>;
}

export function ModifierGroupsEditor({
  productId,
  linkedGroups,
  availableGroups,
}: ModifierGroupsEditorProps) {
  const router = useRouter();
  const [linkGroupId, setLinkGroupId] = useState("");
  const [newGroupName, setNewGroupName] = useState("Extra toppings");
  const [isRequired, setIsRequired] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState(linkedGroups[0]?.id ?? "");
  const [modName, setModName] = useState("");
  const [modPrice, setModPrice] = useState(0);

  const refresh = () => router.refresh();

  const linkExisting = async () => {
    if (!linkGroupId) return;
    const result = await apiPost(
      `/api/admin/products/${productId}/modifier-groups/${linkGroupId}/link`
    );
    if (!result.ok) {
      toast.error(result.error ?? "Failed");
      return;
    }
    toast.success("Modifier group linked");
    setLinkGroupId("");
    refresh();
  };

  const unlink = async (groupId: string) => {
    const result = await apiDelete(
      `/api/admin/products/${productId}/modifier-groups/${groupId}/link`
    );
    if (!result.ok) {
      toast.error(result.error ?? "Failed");
      return;
    }
    toast.success("Modifier group unlinked");
    refresh();
  };

  const createGroup = async () => {
    if (!newGroupName.trim()) return;
    const result = await apiPost(`/api/admin/products/${productId}/modifier-groups`, {
      name: newGroupName.trim(),
      isRequired,
      minSelect: isRequired ? 1 : 0,
      maxSelect: 0,
    });
    if (!result.ok) {
      toast.error(result.error ?? "Failed");
      return;
    }
    toast.success("Modifier group created");
    refresh();
  };

  const addModifier = async (groupId: string) => {
    if (!modName.trim()) return;
    const result = await apiPost(
      `/api/admin/products/${productId}/modifier-groups/${groupId}/modifiers`,
      { name: modName.trim(), price: rupeesToPaise(modPrice), groupId }
    );
    if (!result.ok) {
      toast.error(result.error ?? "Failed");
      return;
    }
    setModName("");
    setModPrice(0);
    toast.success("Modifier added");
    refresh();
  };

  const removeModifier = async (modifierId: string) => {
    const result = await apiDelete(`/api/admin/products/modifiers/${modifierId}`);
    if (!result.ok) {
      toast.error(result.error ?? "Failed");
      return;
    }
    toast.success("Modifier removed");
    refresh();
  };

  const unlinked = availableGroups.filter(
    (g) => !linkedGroups.some((l) => l.id === g.id)
  );

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Modifier prices are add-ons on top of the base product price. Add multiple options
        inside each group (e.g. Extra toppings → cheese, tomato, olives).
      </p>

      {linkedGroups.map((group) => (
        <div key={group.id} className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-semibold">{group.name}</p>
              <p className="text-xs text-muted-foreground">
                {group.isRequired ? "Required — pick at least one" : "Optional"}
                {group.maxSelect > 0 ? ` · Max ${group.maxSelect}` : " · Multi-select"}
              </p>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => unlink(group.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>

          {group.modifiers.length === 0 ? (
            <p className="text-sm text-muted-foreground px-2">No modifiers yet — add one below.</p>
          ) : (
            group.modifiers.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-md bg-muted/40 px-3 py-2"
              >
                <span className="flex-1 font-medium">{m.name}</span>
                <span className="text-sm">+{formatCurrency(m.price)}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeModifier(m.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))
          )}

          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Modifier name"
              value={activeGroupId === group.id ? modName : ""}
              onFocus={() => setActiveGroupId(group.id)}
              onChange={(e) => {
                setActiveGroupId(group.id);
                setModName(e.target.value);
              }}
              className="max-w-[160px]"
            />
            <Input
              type="number"
              step="0.01"
              placeholder="+₹"
              value={activeGroupId === group.id ? modPrice : 0}
              onFocus={() => setActiveGroupId(group.id)}
              onChange={(e) => {
                setActiveGroupId(group.id);
                setModPrice(parseFloat(e.target.value) || 0);
              }}
              className="w-28"
            />
            <Button type="button" size="sm" onClick={() => addModifier(group.id)}>
              <Plus className="h-4 w-4" />
              Add Modifier
            </Button>
          </div>
        </div>
      ))}

      {unlinked.length > 0 && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label>Link existing group</Label>
            <Select value={linkGroupId} onValueChange={setLinkGroupId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Choose group" />
              </SelectTrigger>
              <SelectContent>
                {unlinked.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" variant="outline" onClick={linkExisting}>
            <Link2 className="mr-1 h-4 w-4" />
            Link
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2 border-t pt-4">
        <div className="space-y-1">
          <Label>New modifier group</Label>
          <Input
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            className="w-44"
            placeholder="e.g. Extra toppings"
          />
        </div>
        <div className="flex items-center gap-2 pb-2">
          <Switch checked={isRequired} onCheckedChange={setIsRequired} />
          <span className="text-sm">Required</span>
        </div>
        <Button type="button" variant="outline" onClick={createGroup}>
          <Plus className="mr-1 h-4 w-4" />
          Add Modifier Group
        </Button>
      </div>
    </div>
  );
}
