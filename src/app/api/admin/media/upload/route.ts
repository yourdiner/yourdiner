import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { uploadMediaFile } from "@/lib/media-upload-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ ok: false, error: "No file provided" }, { status: 400 });
  }

  const result = await uploadMediaFile(file);
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return NextResponse.json(result);
}
