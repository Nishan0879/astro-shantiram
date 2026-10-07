import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { siteTimeZone } from "./site";

export const ADMIN_COOKIE = "admin_token";

export const messageStatuses = ["new", "read", "replied", "archived"] as const;
export type MessageStatus = (typeof messageStatuses)[number];

export type ContactMessage = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  category: string;
  subject: string;
  message: string;
  locale: string | null;
  status: MessageStatus;
  createdAt: string;
};

export type MessageList = {
  messages: ContactMessage[];
  counts: Record<MessageStatus, number>;
  total: number;
  page: number;
  pageSize: number;
};

export function apiUrl(path: string) {
  const base = process.env.API_URL;
  if (!base) throw new Error("API_URL is not set, so the admin dashboard cannot reach the API");
  return `${base}${path}`;
}

/**
 * Calls an admin API endpoint as the signed-in admin. Sends them to the sign-in
 * page when they have no session or it has expired.
 */
export async function adminFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) redirect("/admin/login");

  const res = await fetch(apiUrl(path), {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (res.status === 401) redirect("/admin/login");
  return res;
}

export async function adminJson<T>(path: string): Promise<T> {
  const res = await adminFetch(path);
  if (!res.ok) throw new Error(`API ${path} responded ${res.status}`);
  return res.json() as Promise<T>;
}

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: siteTimeZone,
  }).format(new Date(iso));
}
