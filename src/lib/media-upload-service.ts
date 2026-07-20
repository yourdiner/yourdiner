import { prisma } from "@/lib/db";
import { requireTenantContext, requireRestaurantStaff } from "@/lib/tenancy";
import { requirePlanFeature } from "@/lib/permissions";
import { uploadImage } from "@/lib/storage";
import { getErrorMessage } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy-types";

export type MediaRecord = {
  id: string;
  url: string;
  filename: string | null;
  width: number | null;
  height: number | null;
};

export type MediaServiceResult<T> = { ok: true; data: T } | { ok: false; error: string };

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function sniffImageMime(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 6 &&
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return "image/gif";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

async function requireAdminMediaAccess(): Promise<TenantContext> {
  const tenant = await requireTenantContext();
  await requireRestaurantStaff(tenant.restaurantId, ["OWNER", "MANAGER"]);
  return tenant;
}

async function saveUploadedFile(
  tenant: TenantContext,
  file: File
): Promise<MediaServiceResult<MediaRecord>> {
  if (!file?.size) return { ok: false, error: "No file provided" };
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "File too large (max 5MB)" };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "File too large (max 5MB)" };
  }

  const sniffed = sniffImageMime(buffer);
  const declared = (file.type || "").toLowerCase();
  const mime =
    sniffed && (!declared || declared === sniffed)
      ? sniffed
      : ALLOWED_MIME.has(declared)
        ? declared
        : null;

  if (!mime || !ALLOWED_MIME.has(mime)) {
    return { ok: false, error: "Only JPEG, PNG, WebP, and GIF images are allowed" };
  }
  if (sniffed !== mime) {
    return { ok: false, error: "File content does not match image type" };
  }

  const result = await uploadImage(buffer, tenant.slug, file.name);

  const media = await prisma.media.create({
    data: {
      restaurantId: tenant.restaurantId,
      url: result.url,
      publicId: result.publicId,
      cloudinaryId: result.publicId,
      filename: file.name,
      mimeType: mime,
      sizeBytes: result.sizeBytes,
      width: result.width,
      height: result.height,
    },
  });

  return {
    ok: true,
    data: {
      id: media.id,
      url: media.url,
      filename: media.filename,
      width: media.width,
      height: media.height,
    },
  };
}

export async function uploadMediaFile(file: File): Promise<MediaServiceResult<MediaRecord>> {
  try {
    const tenant = await requireAdminMediaAccess();
    return saveUploadedFile(tenant, file);
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function addProductImageFile(
  productId: string,
  file: File,
  isPrimary = false
): Promise<MediaServiceResult<{ productImageId: string; url: string }>> {
  try {
    const tenant = await requireAdminMediaAccess();

    const product = await prisma.product.findFirst({
      where: { id: productId, restaurantId: tenant.restaurantId },
    });
    if (!product) return { ok: false, error: "Product not found" };

    const upload = await saveUploadedFile(tenant, file);
    if (!upload.ok) return upload;

    if (isPrimary) {
      await prisma.productImage.updateMany({
        where: { productId },
        data: { isPrimary: false },
      });
    }

    const maxOrder = await prisma.productImage.aggregate({
      where: { productId },
      _max: { sortOrder: true },
    });

    const productImage = await prisma.productImage.create({
      data: {
        productId,
        mediaId: upload.data.id,
        isPrimary,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
      include: { media: true },
    });

    return {
      ok: true,
      data: { productImageId: productImage.id, url: productImage.media.url },
    };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function removeProductImageById(
  productImageId: string
): Promise<MediaServiceResult<void>> {
  try {
    const tenant = await requireAdminMediaAccess();

    const image = await prisma.productImage.findFirst({
      where: { id: productImageId, product: { restaurantId: tenant.restaurantId } },
    });
    if (!image) return { ok: false, error: "Image not found" };

    await prisma.productImage.delete({ where: { id: productImageId } });
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function uploadBrandingImageFile(
  type: "logo" | "cover" | "favicon",
  file: File
): Promise<MediaServiceResult<{ url: string }>> {
  try {
    const tenant = await requireAdminMediaAccess();
    await requirePlanFeature(tenant.restaurantId, "branding");

    const upload = await saveUploadedFile(tenant, file);
    if (!upload.ok) return upload;

    const fieldMap = { logo: "logoId", cover: "coverId", favicon: "faviconId" } as const;

    await prisma.restaurantBranding.upsert({
      where: { restaurantId: tenant.restaurantId },
      update: { [fieldMap[type]]: upload.data.id },
      create: { restaurantId: tenant.restaurantId, [fieldMap[type]]: upload.data.id },
    });

    return { ok: true, data: { url: upload.data.url } };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}
