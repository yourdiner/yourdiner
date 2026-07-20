"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  generateMenuQR,
  regenerateQR,
  invalidateQR,
  generateQRImageDataUrl,
} from "@/lib/qr-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Download, RefreshCw, Trash2, Printer } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import Image from "next/image";

interface QRCodeItem {
  id: string;
  url: string;
  mode: string;
  token: string;
  createdAt: Date;
  invalidatedAt: Date | null;
}

export function QRCodesManager({ initialQRCodes }: { initialQRCodes: QRCodeItem[] }) {
  const router = useRouter();
  const [qrCodes, setQrCodes] = useState(initialQRCodes);
  const [qrImages, setQrImages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    qrCodes.forEach(async (qr) => {
      if (!qrImages[qr.id]) {
        const dataUrl = await generateQRImageDataUrl(qr.url);
        if (dataUrl) {
          setQrImages((prev) => ({ ...prev, [qr.id]: dataUrl }));
        }
      }
    });
  }, [qrCodes, qrImages]);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const result = await generateMenuQR();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const qr = result.data;
      setQrCodes([qr, ...qrCodes]);
      const dataUrl = await generateQRImageDataUrl(qr.url);
      if (dataUrl) {
        setQrImages((prev) => ({ ...prev, [qr.id]: dataUrl }));
      }
      toast.success("QR code generated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async (id: string) => {
    try {
      const result = await regenerateQR(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const newQr = result.data;
      setQrCodes(qrCodes.filter((q) => q.id !== id).concat(newQr));
      const dataUrl = await generateQRImageDataUrl(newQr.url);
      if (dataUrl) {
        setQrImages((prev) => ({ ...prev, [newQr.id]: dataUrl }));
      }
      toast.success("QR code regenerated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    }
  };

  const handleInvalidate = async (id: string) => {
    try {
      const result = await invalidateQR(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setQrCodes(qrCodes.filter((q) => q.id !== id));
      toast.success("QR code invalidated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    }
  };

  const handleDownload = (id: string, url: string) => {
    const dataUrl = qrImages[id];
    if (!dataUrl) return;
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `qr-menu-${id}.png`;
    link.click();
  };

  const handlePrint = (id: string) => {
    const dataUrl = qrImages[id];
    if (!dataUrl) return;
    const win = window.open("");
    if (win) {
      win.document.write(`<img src="${dataUrl}" style="width:100%;max-width:400px" />`);
      win.document.close();
      win.print();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Generate QR codes for your customer menu. Customers scan to view your digital menu.
        </p>
        <Button onClick={handleGenerate} disabled={loading}>
          <Plus className="mr-2 h-4 w-4" />
          {loading ? "Generating..." : "Generate Menu QR"}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {qrCodes.map((qr) => (
          <Card key={qr.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Menu QR</CardTitle>
                <Badge variant="outline">{qr.mode.replace("_", " ")}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {qrImages[qr.id] && (
                <div className="flex justify-center">
                  <Image
                    src={qrImages[qr.id]}
                    alt="QR Code"
                    width={200}
                    height={200}
                    className="rounded-lg"
                  />
                </div>
              )}
              <p className="text-xs text-muted-foreground break-all text-center">{qr.url}</p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" size="icon" onClick={() => handleDownload(qr.id, qr.url)}>
                  <Download className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => handlePrint(qr.id)}>
                  <Printer className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => handleRegenerate(qr.id)}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => handleInvalidate(qr.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Created {formatDate(qr.createdAt)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {qrCodes.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          No QR codes yet. Generate one to get started.
        </div>
      )}
    </div>
  );
}
