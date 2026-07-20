"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { updateBranding } from "@/lib/branding-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const infoSchema = z.object({
  about: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  googleMapsUrl: z.string().url().optional().or(z.literal("")),
});

type InfoInput = z.infer<typeof infoSchema>;

interface SettingsRestaurantInfoProps {
  branding: {
    about: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    phone: string | null;
    email: string | null;
    googleMapsUrl: string | null;
  } | null;
}

export function SettingsRestaurantInfo({ branding }: SettingsRestaurantInfoProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const form = useForm<InfoInput>({
    resolver: zodResolver(infoSchema),
    defaultValues: {
      about: branding?.about || "",
      address: branding?.address || "",
      city: branding?.city || "",
      state: branding?.state || "",
      postalCode: branding?.postalCode || "",
      phone: branding?.phone || "",
      email: branding?.email || "",
      googleMapsUrl: branding?.googleMapsUrl || "",
    },
  });

  const onSubmit = async (data: InfoInput) => {
    setLoading(true);
    try {
      const result = await updateBranding(data);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Restaurant info saved");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Restaurant Info</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label>About</Label>
            <Textarea {...form.register("about")} rows={4} />
          </div>
          <div className="space-y-2">
            <Label>Address</Label>
            <Input {...form.register("address")} />
          </div>
          <div className="space-y-2">
            <Label>City</Label>
            <Input {...form.register("city")} />
          </div>
          <div className="space-y-2">
            <Label>State</Label>
            <Input {...form.register("state")} />
          </div>
          <div className="space-y-2">
            <Label>Postal Code</Label>
            <Input {...form.register("postalCode")} />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input {...form.register("phone")} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input {...form.register("email")} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Google Maps URL</Label>
            <Input {...form.register("googleMapsUrl")} />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Restaurant Info"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
