import type { Metadata } from "next";
import { Suspense } from "react";
import ChangePasswordForm from "./ChangePasswordForm";
import EmailStatus from "./EmailStatus";
import ZoomStatus from "./ZoomStatus";

export const metadata: Metadata = { title: "Account" };

export default function AccountPage() {
  return (
    <>
      <h1 className="mb-4 font-serif text-2xl text-maroon">Account</h1>
      <div className="space-y-6">
        <section className="max-w-sm rounded-xl border border-gold/30 bg-warm-white p-5">
          <h2 className="mb-1 font-medium">Change password</h2>
          <p className="mb-4 text-sm text-charcoal/70">This also signs you out on every other device.</p>
          <ChangePasswordForm />
        </section>
        <Suspense fallback={null}>
          <EmailStatus />
        </Suspense>
        <Suspense fallback={null}>
          <ZoomStatus />
        </Suspense>
      </div>
    </>
  );
}
