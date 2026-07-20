"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { uploadBrandingImage } from "@/lib/media-client";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { toast } from "sonner";

interface ImageUploadProps {
  type: "logo" | "cover" | "favicon";
  currentImage: { id: string; url: string } | null;
  label: string;
}

export function ImageUpload({ type, currentImage, label }: ImageUploadProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await uploadBrandingImage(type, file);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${label} uploaded`);
      router.refresh();
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="relative flex h-32 items-center justify-center rounded-lg border border-dashed bg-muted/30">
        {currentImage ? (
          <>
            <Image
              src={currentImage.url}
              alt={label}
              fill
              className="rounded-lg object-contain p-2"
              unoptimized={currentImage.url.startsWith("data:")}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 h-6 w-6"
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-3 w-3" />
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="ghost"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="mr-2 h-4 w-4" />
            {uploading ? "Uploading..." : "Upload"}
          </Button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleUpload}
        />
      </div>
    </div>
  );
}
