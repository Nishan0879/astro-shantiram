import type { UploadFolder } from "@/lib/media";
import { signUpload } from "./media-actions";

export type UploadedPhoto = { url: string; publicId: string; width: number; height: number };
export type UploadedPdf = { url: string; publicId: string; pages: number | null };

// Cloudinary's free plan accepts photos and PDFs up to 10 MB
const MAX_BYTES = 10 * 1024 * 1024;

/** Uploads one photo from the browser straight to Cloudinary. Throws a readable message on failure. */
export async function uploadPhoto(file: File, folder: UploadFolder): Promise<UploadedPhoto> {
  if (!file.type.startsWith("image/")) throw new Error(`${file.name} is not a photo.`);
  const body = await upload(file, folder);
  return { url: body.secure_url, publicId: body.public_id, width: body.width, height: body.height };
}

/** Uploads a book's PDF. Cloudinary stores it as an image, so it can show any page as a picture. */
export async function uploadPdf(file: File): Promise<UploadedPdf> {
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) throw new Error(`${file.name} is not a PDF.`);
  const body = await upload(file, "books");
  return { url: body.secure_url, publicId: body.public_id, pages: body.pages ?? null };
}

type CloudinaryUpload = { secure_url: string; public_id: string; width: number; height: number; pages?: number };

async function upload(file: File, folder: UploadFolder): Promise<CloudinaryUpload> {
  if (file.size > MAX_BYTES) throw new Error(`${file.name} is larger than 10 MB, the most Cloudinary's free plan accepts.`);

  const sig = await signUpload(folder);
  if ("error" in sig) throw new Error(sig.error);

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", sig.apiKey);
  form.append("timestamp", String(sig.timestamp));
  form.append("folder", sig.folder);
  form.append("signature", sig.signature);

  const res = await fetch(sig.uploadUrl, { method: "POST", body: form }).catch(() => null);
  if (!res) throw new Error(`Uploading ${file.name} failed. Check the internet connection and try again.`);
  if (!res.ok) {
    // Cloudinary explains itself, e.g. "Invalid Signature" when CLOUDINARY_URL has the wrong secret
    const reason = ((await res.json().catch(() => null)) as { error?: { message?: string } } | null)?.error?.message;
    throw new Error(`Uploading ${file.name} failed${reason ? `: Cloudinary says "${reason}"` : ". Please try again."}`);
  }
  return (await res.json()) as CloudinaryUpload;
}
