import { createHash } from "node:crypto";

export type UploadSignature = {
  uploadUrl: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
};

/** Where photos are stored. Cloudinary in production, a fake in tests. */
export type Media = {
  /** Lets the browser upload one file straight to storage, into this folder only. */
  signUpload(folder: string): UploadSignature;
  /** Whether a URL points at our own storage (so we never store arbitrary links). */
  owns(url: string): boolean;
  destroy(publicId: string): Promise<void>;
};

export type CloudinaryConfig = { cloudName: string; apiKey: string; apiSecret: string };

/** Reads "cloudinary://<api_key>:<api_secret>@<cloud_name>", as shown on the Cloudinary dashboard. */
export function parseCloudinaryUrl(value: string): CloudinaryConfig | null {
  // People often paste the whole "CLOUDINARY_URL=cloudinary://..." line from the dashboard
  const cleaned = value.trim().replace(/^CLOUDINARY_URL=/, "").replace(/^["']|["']$/g, "");
  const match = cleaned.match(/^cloudinary:\/\/([^:]+):([^@]+)@([^/?\s]+)/);
  return match ? { apiKey: match[1], apiSecret: match[2], cloudName: match[3] } : null;
}

/** Cloudinary's request signature: sorted params joined with &, plus the secret, SHA-1. */
export function signParams(params: Record<string, string | number>, apiSecret: string) {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1").update(toSign + apiSecret).digest("hex");
}

export const ROOT_FOLDER = "astro-shantiram";

export function cloudinaryMedia(
  { cloudName, apiKey, apiSecret }: CloudinaryConfig,
  apiBase = "https://api.cloudinary.com",
): Media {
  const endpoint = (action: string) => `${apiBase}/v1_1/${cloudName}/image/${action}`;

  return {
    signUpload(folder) {
      const timestamp = Math.floor(Date.now() / 1000);
      const fullFolder = `${ROOT_FOLDER}/${folder}`;
      return {
        uploadUrl: endpoint("upload"),
        apiKey,
        timestamp,
        folder: fullFolder,
        signature: signParams({ folder: fullFolder, timestamp }, apiSecret),
      };
    },
    owns(url) {
      return url.startsWith(`https://res.cloudinary.com/${cloudName}/image/upload/`);
    },
    async destroy(publicId) {
      const timestamp = Math.floor(Date.now() / 1000);
      const body = new URLSearchParams({
        public_id: publicId,
        timestamp: String(timestamp),
        api_key: apiKey,
        signature: signParams({ public_id: publicId, timestamp }, apiSecret),
      });
      // The gallery entry is already gone; a leftover file only costs storage
      await fetch(endpoint("destroy"), { method: "POST", body })
        .then((res) => {
          if (!res.ok) console.error("Cloudinary destroy failed", res.status);
        })
        .catch((err) => console.error("Cloudinary destroy failed", err));
    },
  };
}
