import type { Metadata } from "next";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-gold/30 bg-warm-white p-6 shadow-sm">
        <h1 className="font-serif text-2xl text-maroon">Astro Shantiram</h1>
        <p className="mb-6 text-sm text-charcoal/70">Admin sign in</p>
        <LoginForm />
      </div>
    </main>
  );
}
