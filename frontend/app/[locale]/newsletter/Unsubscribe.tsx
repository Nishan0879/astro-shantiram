"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { type LeaveState, unsubscribe } from "./actions";

// A button rather than leaving on page load, so email scanners that open links cannot unsubscribe anyone
export default function Unsubscribe({ email, keyValue }: { email: string; keyValue: string }) {
  const t = useTranslations("Newsletter");
  const [state, action, pending] = useActionState<LeaveState, FormData>(() => unsubscribe(email, keyValue), { status: "idle" });
  if (state.status === "done") return <p className="rounded-lg bg-cream p-6 text-lg">{t("left")}</p>;
  if (state.status === "invalid") return <p className="rounded-lg bg-cream p-6 text-lg">{t("badLink")}</p>;
  return (
    <form action={action} className="rounded-lg bg-cream p-6">
      <p className="text-lg">{t("leaveQuestion", { email })}</p>
      <button type="submit" disabled={pending} className="mt-4 rounded-full bg-saffron px-6 py-3 font-medium text-white hover:bg-saffron-dark disabled:opacity-60">
        {t("leaveButton")}
      </button>
      {state.status === "failed" && <p className="mt-3 text-red-700">{t("failed")}</p>}
    </form>
  );
}
