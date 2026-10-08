"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { phoneInputProps, tenDigits } from "@/lib/phone";
import { inquiryCategories } from "@/lib/services";
import { submitContact, type ContactState } from "./actions";

const inputClass =
  "mt-1 w-full rounded border border-gold/40 bg-warm-white px-3 py-2 focus:border-saffron focus:outline-none";

export default function ContactForm({
  category = "general",
  subject = "",
}: {
  category?: (typeof inquiryCategories)[number];
  subject?: string;
}) {
  const t = useTranslations("Contact");
  const [state, action, pending] = useActionState<ContactState, FormData>(
    submitContact,
    { status: "idle" },
  );
  const [phone, setPhone] = useState("");

  if (state.status === "success") {
    return <p className="rounded-lg bg-cream p-6 text-lg">{t("success")}</p>;
  }

  const invalid = (field: keyof NonNullable<ContactState["fieldErrors"]>) =>
    state.fieldErrors?.[field] ? "border-red-600" : "";

  return (
    <form action={action} className="space-y-4">
      {state.status === "error" && <p className="text-red-700">{t("error")}</p>}
      {state.status === "failed" && <p className="text-red-700">{t("failed")}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          {t("name")}
          <input name="name" required className={`${inputClass} ${invalid("name")}`} />
        </label>
        <label className="block">
          {t("email")}
          <input name="email" type="email" required className={`${inputClass} ${invalid("email")}`} />
        </label>
        <label className="block">
          {t("phone")}
          <input name="phone" {...phoneInputProps} value={phone} onChange={(e) => setPhone(tenDigits(e.target.value))} className={`${inputClass} ${invalid("phone")}`} />
        </label>
        <label className="block">
          {t("category")}
          <select name="category" className={inputClass} defaultValue={category}>
            {inquiryCategories.map((c) => (
              <option key={c} value={c}>
                {t(`categories.${c}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        {t("subject")}
        <input name="subject" required defaultValue={subject} className={`${inputClass} ${invalid("subject")}`} />
      </label>
      <label className="block">
        {t("message")}
        <textarea name="message" rows={6} required className={`${inputClass} ${invalid("message")}`} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-saffron px-6 py-3 font-medium text-white hover:bg-saffron-dark disabled:opacity-60"
      >
        {pending ? t("sending") : t("submit")}
      </button>
    </form>
  );
}
