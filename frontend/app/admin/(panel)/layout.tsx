import Link from "next/link";
import { logout } from "../actions";

const nav = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/messages", label: "Messages" },
  { href: "/admin/articles", label: "Articles" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/gallery", label: "Gallery" },
  { href: "/admin/books", label: "Books" },
  { href: "/admin/videos", label: "Videos" },
  { href: "/admin/horoscopes", label: "Horoscopes" },
  { href: "/admin/account", label: "Account" },
] as const;

export default function PanelLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <header className="border-b border-gold/30 bg-warm-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/admin" className="font-serif text-lg font-semibold text-maroon">
            Astro Shantiram Admin
          </Link>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-saffron">
                {item.label}
              </Link>
            ))}
            <Link href="/" className="hover:text-saffron">
              View site
            </Link>
            <form action={logout}>
              <button type="submit" className="text-charcoal/70 hover:text-saffron">
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </>
  );
}
