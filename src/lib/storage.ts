import { v2 as cloudinary } from "cloudinary";
import { slugify } from "@/lib/utils";

/** Root folder in Cloudinary for all cafe POS uploads. */
export const CLOUDINARY_ROOT_FOLDER = "Cafe Pos system";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface UploadResult {
  url: string;
  publicId: string;
  width?: number;
  height?: number;
  sizeBytes?: number;
}

/** `Cafe Pos system/{restaurant-slug}` */
export function getRestaurantCloudinaryFolder(restaurantSlug: string): string {
  const safeSlug = slugify(restaurantSlug) || "restaurant";
  return `${CLOUDINARY_ROOT_FOLDER}/${safeSlug}`;
}

export async function uploadImage(
  buffer: Buffer,
  restaurantSlug: string,
  filename?: string
): Promise<UploadResult> {
  const folder = getRestaurantCloudinaryFolder(restaurantSlug);

  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    // Local dev fallback when Cloudinary is not configured
    const base64 = buffer.toString("base64");
    const mimeType = "image/jpeg";
    return {
      url: `data:${mimeType};base64,${base64}`,
      publicId: `local/${folder}/${filename || Date.now()}`,
    };
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        use_filename: Boolean(filename),
        unique_filename: true,
        overwrite: false,
        transformation: [{ quality: "auto", fetch_format: "auto" }],
      },
      (error, result) => {
        if (error || !result) {
          reject(
            error instanceof Error
              ? error
              : new Error(typeof error === "object" && error && "message" in error ? String((error as { message: unknown }).message) : "Cloudinary upload failed")
          );
          return;
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
          sizeBytes: result.bytes,
        });
      }
    );
    uploadStream.end(buffer);
  });
}

export async function deleteImage(publicId: string): Promise<void> {
  if (!process.env.CLOUDINARY_CLOUD_NAME) return;
  await cloudinary.uploader.destroy(publicId);
}

export function getOptimizedImageUrl(
  url: string,
  options: { width?: number; height?: number } = {}
): string {
  if (!url.includes("cloudinary.com")) return url;

  const { width = 800, height } = options;
  const transforms = [`w_${width}`, "q_auto", "f_auto"];
  if (height) transforms.push(`h_${height}`, "c_fill");

  return url.replace("/upload/", `/upload/${transforms.join(",")}/`);
}
