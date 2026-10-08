"use client";

import { useTranslations } from "next-intl";
import { useActionState, useId } from "react";
import { subscribe, type SignupState } from "@/app/[locale]/newsletter/actions";
import SpamTrap from "./SpamTrap";

/** An email box for festival, horoscope and event updates. */
export default function NewsletterSignup({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const t = useTranslations("Newsletter");
  const id = useId();
  const [state, action, pending] = useActionState<SignupState, FormData>(subscribe, { status: "idle" });
  const dark = tone === "dark";

  if (state.status === "done") {
    return (
      <p role="status" className={dark ? "text-gold" : "rounded-lg bg-cream p-4"}>
        {t("checkEmail")}
      </p>
    );
  }
  return (
    <form action={action} className="relative mx-auto max-w-md">
      <SpamTrap />
      <label htmlFor={id} className={dark ? "block font-serif text-lg" : "block font-medium"}>
        {t("signupTitle")}
      </label>
      <p className={`mt-1 text-sm ${dark ? "opacity-80" : "text-charcoal/70"}`}>{t("signupText")}</p>
      <div className="mt-3 flex gap-2">
        <input
          id={id}
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder={t("emailPlaceholder")}
          className={`min-w-0 flex-1 rounded-full border px-4 py-2 text-charcoal focus:border-saffron focus:outline-none ${
            dark ? "border-gold/40 bg-cream" : "border-gold/40 bg-warm-white"
          }`}
        />
        <button type="submit" disabled={pending} className="shrink-0 rounded-full bg-saffron px-5 py-2 font-medium text-white hover:bg-saffron-dark disabled:opacity-60">
          {pending ? t("sending") : t("submit")}
        </button>
      </div>
      {state.status === "invalid" && <p className={`mt-2 text-sm ${dark ? "text-gold" : "text-red-700"}`}>{t("invalid")}</p>}
      {state.status === "failed" && <p className={`mt-2 text-sm ${dark ? "text-gold" : "text-red-700"}`}>{t("failed")}</p>}
    </form>
  );
}
