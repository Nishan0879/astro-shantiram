import { adminFetch } from "@/lib/admin-api";
import ZoomCheckButton from "./ZoomCheckButton";

export default async function ZoomStatus() {
  const res = await adminFetch("/api/admin/zoom");
  // Only the main admin manages Zoom; everyone else simply doesn't see this section.
  if (res.status === 403) return null;
  if (!res.ok) {
    console.error("Failed to load Zoom status", res.status);
    return null;
  }
  const { configured } = (await res.json()) as { configured: boolean };

  return (
    <section className="max-w-sm rounded-xl border border-gold/30 bg-warm-white p-5">
      <h2 className="mb-1 font-medium">Zoom</h2>
      {configured ? (
        <p className="mb-4 text-sm text-green-900">
          Zoom is set up. Confirming a Zoom booking makes the meeting and emails the link.
        </p>
      ) : (
        <p className="mb-4 text-sm text-red-800">
          Zoom is not set up yet, so paste meeting links by hand. Add the Zoom settings to the backend project in Vercel.
        </p>
      )}
      <ZoomCheckButton />
    </section>
  );
}
