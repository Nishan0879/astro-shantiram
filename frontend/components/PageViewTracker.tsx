"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/** Reports each page a visitor opens, for the admin's Visitors page. No cookies. */
export default function PageViewTracker() {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    // Only the first page has an outside referrer; later pages are moves within the site
    const referrer = first.current ? document.referrer : "";
    first.current = false;
    const body = JSON.stringify({ path: pathname, referrer });
    if (navigator.sendBeacon?.("/api/view", new Blob([body], { type: "application/json" }))) return;
    fetch("/api/view", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
  }, [pathname]);

  return null;
}
