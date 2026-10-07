"use server";

import { refresh } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, adminFetch, apiUrl, messageStatuses, type MessageStatus } from "@/lib/admin-api";

const SESSION_SECONDS = 7 * 24 * 60 * 60;

async function setSession(token: string) {
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/admin",
    maxAge: SESSION_SECONDS,
  });
}

export type FormState = { error?: string; ok?: boolean; email?: string };

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "");
  const failed = (error: string) => ({ error, email });
  let res: Response;
  try {
    res = await fetch(apiUrl("/api/auth/login"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Lets the API rate-limit sign-in attempts per visitor
        "X-Internal-Key": process.env.INTERNAL_API_KEY ?? "",
        "X-Visitor-IP": (await headers()).get("x-forwarded-for")?.split(",")[0].trim() ?? "",
      },
      body: JSON.stringify({ email, password: formData.get("password") }),
    });
  } catch (err) {
    console.error("Login: API unreachable", err);
    return failed("Could not reach the server. Please try again.");
  }

  if (res.status === 401 || res.status === 400) return failed("Wrong email or password.");
  if (res.status === 429) return failed("Too many attempts. Please wait 15 minutes and try again.");
  if (res.status === 503) return failed("Sign-in is not set up yet (JWT_SECRET is missing on the API).");
  if (!res.ok) {
    console.error("Login: API responded", res.status, await res.text());
    return failed("Something went wrong. Please try again.");
  }

  await setSession(((await res.json()) as { token: string }).token);
  redirect("/admin");
}

export async function logout() {
  (await cookies()).delete({ name: ADMIN_COOKIE, path: "/admin" });
  redirect("/admin/login");
}

export async function setMessageStatus(id: string, status: MessageStatus) {
  if (!messageStatuses.includes(status)) return;
  const res = await adminFetch(`/api/admin/contact-messages/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`Updating message failed: ${res.status}`);
  refresh();
}

export async function deleteMessage(id: string) {
  const res = await adminFetch(`/api/admin/contact-messages/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 404) throw new Error(`Deleting message failed: ${res.status}`);
  redirect("/admin/messages");
}

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const newPassword = String(formData.get("newPassword") ?? "");
  if (newPassword.length < 10) return { error: "The new password needs at least 10 characters." };
  if (newPassword !== formData.get("confirmPassword")) return { error: "The new passwords do not match." };

  const res = await adminFetch("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword: formData.get("currentPassword"), newPassword }),
  });
  if (res.status === 400) {
    const body = (await res.json()) as { error?: string };
    return {
      error: body.error === "wrong_password" ? "Your current password is not right." : "Please check the form.",
    };
  }
  if (res.status === 429) return { error: "Too many attempts. Please wait 15 minutes and try again." };
  if (!res.ok) return { error: "Something went wrong. Please try again." };

  // Other devices are now signed out; keep this one signed in with the new token
  await setSession(((await res.json()) as { token: string }).token);
  return { ok: true };
}
