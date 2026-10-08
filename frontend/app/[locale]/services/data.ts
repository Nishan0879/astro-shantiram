import type { PublicService, ServiceSummary } from "@/lib/services";
import { publicJson } from "@/lib/public-api";

export async function getServices(locale: string) {
  return (await publicJson<{ services: ServiceSummary[] }>(`/api/services?locale=${locale}`))?.services ?? [];
}

export async function getService(slug: string, locale: string) {
  const data = await publicJson<{ service: PublicService }>(`/api/services/${encodeURIComponent(slug)}?locale=${locale}`);
  return data?.service ?? null;
}
