import { connection } from "next/server";
import { publicJson } from "@/lib/public-api";
import type { ServiceSummary } from "@/lib/services";

/** Services a festival can offer a booking link for. */
export async function bookableServices() {
  // Read when the page is opened, not when the site is built
  await connection();
  const services = (await publicJson<{ services: ServiceSummary[] }>("/api/services?locale=en"))?.services ?? [];
  return services.filter((s) => s.bookingOpen).map((s) => ({ slug: s.slug, name: s.name }));
}
