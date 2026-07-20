"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Upload, X } from "lucide-react";

export function ProductImagePicker({
  file,
  onFileChange,
  disabled,
}: {
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(selected));
    onFileChange(selected);
  }

  function clear() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    onFileChange(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={disabled}
        onChange={handleSelect}
      />
      {preview ? (
        <div className="relative aspect-video w-full max-w-xs overflow-hidden rounded-lg border bg-muted/30">
          <Image src={preview} alt="Preview" fill className="object-cover" unoptimized />
          <Button
            type="button"
            size="icon"
            variant="destructive"
            className="absolute right-2 top-2 h-8 w-8"
            disabled={disabled}
            onClick={clear}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full max-w-xs"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="mr-2 h-4 w-4" />
          Choose image
        </Button>
      )}
    </div>
  );
}
