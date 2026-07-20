"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { brandingSchema, type BrandingInput } from "@/features/branding/schemas";
import { updateBranding } from "@/lib/branding-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageUpload } from "@/features/branding/components/image-upload";
import { toast } from "sonner";
import { parseSocialLinks, socialLinksToPayload, SOCIAL_LINK_KEYS, SOCIAL_LINK_LABELS } from "@/lib/social-links";

interface BrandingFormProps {
  branding: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    fontFamily: string;
    about: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    phone: string | null;
    email: string | null;
    googleMapsUrl: string | null;
    socialLinks?: unknown;
    gstNumber: string | null;
    panNumber: string | null;
    invoiceFooter: string | null;
    receiptFooter: string | null;
    logo: { id: string; url: string } | null;
    cover: { id: string; url: string } | null;
    favicon: { id: string; url: string } | null;
  };
}

export function BrandingForm({ branding }: BrandingFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const socialDefaults = parseSocialLinks(branding.socialLinks);

  const form = useForm<BrandingInput>({
    resolver: zodResolver(brandingSchema),
    defaultValues: {
      primaryColor: branding.primaryColor,
      secondaryColor: branding.secondaryColor,
      accentColor: branding.accentColor,
      fontFamily: branding.fontFamily,
      about: branding.about || "",
      address: branding.address || "",
      city: branding.city || "",
      state: branding.state || "",
      postalCode: branding.postalCode || "",
      phone: branding.phone || "",
      email: branding.email || "",
      googleMapsUrl: branding.googleMapsUrl || "",
      socialLinks: socialDefaults,
      gstNumber: branding.gstNumber || "",
      panNumber: branding.panNumber || "",
      invoiceFooter: branding.invoiceFooter || "",
      receiptFooter: branding.receiptFooter || "",
    },
  });

  const onSubmit = async (data: BrandingInput) => {
    setLoading(true);
    try {
      const { socialLinks: _sl, ...rest } = data;
      const socialFromForm = form.getValues("socialLinks") as Record<string, string> | undefined;
      const result = await updateBranding({
        ...rest,
        socialLinks: socialLinksToPayload(socialFromForm ?? {}),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Branding updated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Tabs defaultValue="theme">
        <TabsList>
          <TabsTrigger value="theme">Theme</TabsTrigger>
          <TabsTrigger value="info">Restaurant Info</TabsTrigger>
          <TabsTrigger value="tax">Tax & Receipt</TabsTrigger>
        </TabsList>

        <TabsContent value="theme" className="space-y-6 mt-6">
          <div className="grid gap-6 md:grid-cols-3">
            <ImageUpload type="logo" currentImage={branding.logo} label="Logo" />
            <ImageUpload type="cover" currentImage={branding.cover} label="Cover Image" />
            <ImageUpload type="favicon" currentImage={branding.favicon} label="Favicon" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Colors</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              {(["primaryColor", "secondaryColor", "accentColor"] as const).map((field) => {
                const value = form.watch(field) || "#000000";
                return (
                <div key={field} className="space-y-2">
                  <Label>{field.replace("Color", " Color")}</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={value}
                      onChange={(e) => form.setValue(field, e.target.value, { shouldDirty: true })}
                      className="h-9 w-12 p-1"
                    />
                    <Input
                      value={value}
                      onChange={(e) => form.setValue(field, e.target.value, { shouldDirty: true })}
                    />
                  </div>
                </div>
              );
              })}
              <div className="space-y-2">
                <Label>Font Family</Label>
                <Input {...form.register("fontFamily")} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="info" className="space-y-6 mt-6">
          <Card>
            <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Social Media</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {SOCIAL_LINK_KEYS.map((key) => (
                <div key={key} className="space-y-2">
                  <Label>{SOCIAL_LINK_LABELS[key]}</Label>
                  <Input
                    value={(form.watch("socialLinks") as Record<string, string> | undefined)?.[key] ?? ""}
                    onChange={(e) =>
                      form.setValue(
                        "socialLinks",
                        {
                          ...(form.getValues("socialLinks") as Record<string, string> | undefined),
                          [key]: e.target.value,
                        },
                        { shouldDirty: true }
                      )
                    }
                    placeholder={`https://...`}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tax" className="space-y-6 mt-6">
          <Card>
            <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label>GST Number</Label>
                <Input {...form.register("gstNumber")} />
              </div>
              <div className="space-y-2">
                <Label>PAN Number</Label>
                <Input {...form.register("panNumber")} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Receipt Footer</Label>
                <Textarea {...form.register("receiptFooter")} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Invoice Footer</Label>
                <Textarea {...form.register("invoiceFooter")} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Button type="submit" disabled={loading}>
        {loading ? "Saving..." : "Save Changes"}
      </Button>
    </form>
  );
}
