"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createRestaurant } from "@/features/restaurants/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RequiredLabel } from "@/components/ui/required-label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { generateSubdomain } from "@/lib/utils";

export type CreateRestaurantPlanOption = {
  slug: string;
  name: string;
};

export function CreateRestaurantDialog({
  plans,
}: {
  plans: CreateRestaurantPlanOption[];
}) {
  const router = useRouter();
  const defaultSlug = plans[0]?.slug ?? "";
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [planSlug, setPlanSlug] = useState(defaultSlug);
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [ownerAddress, setOwnerAddress] = useState("");
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const planOptions = useMemo(() => plans, [plans]);

  const resetForm = () => {
    setName("");
    setSubdomain("");
    setPlanSlug(planOptions[0]?.slug ?? "");
    setOwnerName("");
    setOwnerEmail("");
    setOwnerPhone("");
    setOwnerAddress("");
    setTempPassword(null);
  };

  const handleCreate = async () => {
    if (!planSlug) {
      toast.error("Create a plan first, then try again");
      return;
    }
    setLoading(true);
    try {
      const result = await createRestaurant({
        name,
        subdomain,
        planSlug,
        ownerName,
        ownerEmail,
        ownerPhone,
        ownerAddress,
      });
      setTempPassword(result.tempPassword);
      toast.success("Restaurant created");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) resetForm();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Restaurant
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Restaurant</DialogTitle>
          {tempPassword ? (
            <DialogDescription>
              Owner temporary password is also saved on the restaurant page in the admin panel
              until they change it.
            </DialogDescription>
          ) : (
            <DialogDescription>
              Create a restaurant with owner account and trial subscription.
            </DialogDescription>
          )}
        </DialogHeader>

        {tempPassword ? (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">Owner login email</p>
              <p className="font-medium">{ownerEmail}</p>
              <p className="mt-3 text-sm text-muted-foreground">Temporary password</p>
              <p className="font-mono text-lg font-semibold">{tempPassword}</p>
            </div>
            <Button className="w-full" onClick={() => handleClose(false)}>
              Done
            </Button>
          </div>
        ) : planOptions.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              No active plans found. Create a plan before adding a restaurant.
            </p>
            <Button asChild className="w-full">
              <Link href="/platform/plans">Go to Plans</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <RequiredLabel>Restaurant Name</RequiredLabel>
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSubdomain(generateSubdomain(e.target.value));
                }}
              />
            </div>
            <div className="space-y-2">
              <RequiredLabel>Subdomain</RequiredLabel>
              <Input value={subdomain} onChange={(e) => setSubdomain(e.target.value)} />
            </div>
            <div className="space-y-2">
              <RequiredLabel>Plan</RequiredLabel>
              <Select value={planSlug} onValueChange={setPlanSlug}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a plan" />
                </SelectTrigger>
                <SelectContent>
                  {planOptions.map((plan) => (
                    <SelectItem key={plan.slug} value={plan.slug}>
                      {plan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="border-t pt-4">
              <p className="mb-3 text-sm font-medium">Owner details</p>
              <div className="space-y-3">
                <div className="space-y-2">
                  <RequiredLabel>Owner name</RequiredLabel>
                  <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <RequiredLabel>Email</RequiredLabel>
                  <Input
                    type="email"
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <RequiredLabel>Phone</RequiredLabel>
                  <Input value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <RequiredLabel>Address</RequiredLabel>
                  <Textarea
                    value={ownerAddress}
                    onChange={(e) => setOwnerAddress(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </div>

            <Button
              onClick={handleCreate}
              disabled={loading || !planSlug}
              className="w-full"
            >
              {loading ? "Creating..." : "Create Restaurant"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
