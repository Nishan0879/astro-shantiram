// Server code only: it sends the website's internal API key
import { headers } from "next/headers";

/** Calls the API's manage-booking routes, passing the visitor's IP so wrong links are limited per visitor. */
export async function manageApi(path: string, init: RequestInit = {}) {
  const apiUrl = process.env.API_URL;
  if (!apiUrl) throw new Error("API_URL is not set");
  return fetch(`${apiUrl}/api/booking/manage/${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Key": process.env.INTERNAL_API_KEY ?? "",
      "X-Visitor-IP": (await headers()).get("x-forwarded-for")?.split(",")[0].trim() ?? "",
    },
    cache: "no-store",
  });
}
