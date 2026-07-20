"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { uploadProductImage, removeProductImage } from "@/lib/media-client";
import { Button } from "@/components/ui/button";
import { Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface ProductImage {
  id: string;
  isPrimary: boolean;
  media: { id: string; url: string };
}

export function ProductImagesSection({
  productId,
  images: initialImages,
}: {
  productId: string;
  images: ProductImage[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await uploadProductImage(
        productId,
        file,
        initialImages.length === 0
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Image uploaded");
      router.refresh();
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = async (imageId: string) => {
    setRemovingId(imageId);
    try {
      const result = await removeProductImage(imageId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Image removed");
      router.refresh();
    } catch {
      toast.error("Failed to remove");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {initialImages.map((img) => (
          <div
            key={img.id}
            className="group relative aspect-square overflow-hidden rounded-lg border bg-muted/30"
          >
            <Image src={img.media.url} alt="Product" fill className="object-cover" unoptimized={img.media.url.startsWith("data:")} />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute right-2 top-2 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
              disabled={removingId === img.id}
              onClick={() => handleRemove(img.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            {img.isPrimary && (
              <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
                Primary
              </span>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/20 text-muted-foreground transition-colors hover:bg-muted/40"
        >
          <Upload className="h-5 w-5" />
          <span className="text-xs">{uploading ? "Uploading…" : "Add image"}</span>
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUpload}
      />
    </div>
  );
}
