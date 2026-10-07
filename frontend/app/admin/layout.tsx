import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Admin | Astro Shantiram" },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-cream/40 font-sans antialiased">{children}</body>
    </html>
  );
}
