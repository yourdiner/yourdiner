"use client";

import { ImageUpload } from "@/features/branding/components/image-upload";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SettingsMediaUploadsProps {
  branding: {
    logo: { id: string; url: string } | null;
    cover: { id: string; url: string } | null;
    favicon: { id: string; url: string } | null;
  } | null;
}

export function SettingsMediaUploads({ branding }: SettingsMediaUploadsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Media</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-3">
          <ImageUpload type="logo" currentImage={branding?.logo ?? null} label="Logo" />
          <ImageUpload type="cover" currentImage={branding?.cover ?? null} label="Cover Image" />
          <ImageUpload type="favicon" currentImage={branding?.favicon ?? null} label="Favicon" />
        </div>
      </CardContent>
    </Card>
  );
}
