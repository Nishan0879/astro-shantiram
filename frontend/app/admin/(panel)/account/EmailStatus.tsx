import { adminFetch } from "@/lib/admin-api";
import TestEmailButton from "./TestEmailButton";

type EmailStatusData = { configured: boolean; notifyEmail: string | null };

export default async function EmailStatus() {
  const res = await adminFetch("/api/admin/email");
  // Only the main admin manages email; everyone else simply doesn't see this section.
  if (res.status === 403) return null;
  if (!res.ok) {
    console.error("Failed to load email status", res.status);
    return null;
  }
  const status = (await res.json()) as EmailStatusData;

  return (
    <section className="max-w-sm rounded-xl border border-gold/30 bg-warm-white p-5">
      <h2 className="mb-1 font-medium">Email</h2>
      {status.configured ? (
        <p className="mb-2 text-sm text-green-900">Email is set up. Customers get booking emails automatically.</p>
      ) : (
        <p className="mb-2 text-sm text-red-800">
          Email is not set up yet, so no booking or message emails are sent. Add the SMTP settings to the backend
          project in Vercel.
        </p>
      )}
      <p className="mb-4 text-sm text-charcoal/70">
        New booking and message alerts go to {status.notifyEmail ?? "nobody yet (CONTACT_NOTIFY_EMAIL is not set)"}.
      </p>
      <TestEmailButton />
    </section>
  );
}
