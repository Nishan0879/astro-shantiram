"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import SpamTrap from "@/components/SpamTrap";
import { submitReview, type ReviewState } from "./actions";

const inputClass = "mt-1 w-full rounded border border-gold/40 bg-warm-white px-3 py-2 focus:border-saffron focus:outline-none";

export default function ReviewForm() {
  const t = useTranslations("Testimonials");
  const [state, action, pending] = useActionState<ReviewState, FormData>(submitReview, { status: "idle" });

  if (state.status === "success") {
    return <p className="rounded-lg bg-cream p-6 text-lg">{t("thanks")}</p>;
  }

  const v = state.values ?? {};
  const error = (field: string) => (state.fieldErrors?.[field] ? "border-red-600" : "");
  const hint = (field: string) =>
    state.fieldErrors?.[field] && (
      <span className="mt-1 block text-sm text-red-700">{t(`errors.${field}` as "errors.name")}</span>
    );

  return (
    <form action={action} className="relative space-y-4">
      <SpamTrap />
      {state.status === "error" && <p className="text-red-700">{t("error")}</p>}
      {state.status === "failed" && <p className="text-red-700">{t("failed")}</p>}

      <fieldset>
        <legend>{t("rating")}</legend>
        {/* Reversed in the markup so CSS can light up a star and the ones before it */}
        <div className="star-input mt-1 inline-flex flex-row-reverse justify-end gap-1 text-3xl">
          {[5, 4, 3, 2, 1].map((n) => (
            <label key={n} className="cursor-pointer">
              <input type="radio" name="rating" value={n} required defaultChecked={v.rating === String(n)} className="peer sr-only" />
              <span aria-hidden="true">★</span>
              <span className="sr-only">{t("stars", { rating: n })}</span>
            </label>
          ))}
        </div>
        {hint("rating")}
      </fieldset>

      <label className="block">
        {t("message")}
        <textarea name="message" rows={5} required minLength={10} maxLength={1500} defaultValue={v.message} className={`${inputClass} ${error("message")}`} />
        {hint("message")}
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          {t("name")}
          <input name="name" required maxLength={80} autoComplete="name" defaultValue={v.name} className={`${inputClass} ${error("name")}`} />
          {hint("name")}
        </label>
        <label className="block">
          {t("place")} <span className="text-sm text-charcoal/60">({t("optional")})</span>
          <input name="place" maxLength={80} placeholder={t("placeExample")} defaultValue={v.place} className={inputClass} />
        </label>
        <label className="block">
          {t("service")} <span className="text-sm text-charcoal/60">({t("optional")})</span>
          <input name="service" maxLength={120} placeholder={t("serviceExample")} defaultValue={v.service} className={inputClass} />
        </label>
        <label className="block">
          {t("email")}
          <input name="email" type="email" required autoComplete="email" defaultValue={v.email} className={`${inputClass} ${error("email")}`} />
          <span className="mt-1 block text-sm text-charcoal/60">{t("emailPrivate")}</span>
          {hint("email")}
        </label>
      </div>
      <button type="submit" disabled={pending} className="rounded-full bg-saffron px-6 py-3 font-medium text-white hover:bg-saffron-dark disabled:opacity-60">
        {pending ? t("sending") : t("submit")}
      </button>
    </form>
  );
}
