"use client";

import { useActionState } from "react";
import { changePassword, type FormState } from "../../actions";
import { inputClass, primaryButtonClass } from "../../styles";

export default function ChangePasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(changePassword, {});

  if (state.ok) {
    return <p className="rounded bg-green-50 p-3 text-sm text-green-900">Your password has been changed.</p>;
  }

  return (
    <form action={action} className="space-y-4">
      {state.error && <p className="rounded bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
      <label className="block text-sm">
        Current password
        <input name="currentPassword" type="password" autoComplete="current-password" required className={inputClass} />
      </label>
      <label className="block text-sm">
        New password (at least 10 characters)
        <input name="newPassword" type="password" autoComplete="new-password" minLength={10} required className={inputClass} />
      </label>
      <label className="block text-sm">
        New password again
        <input name="confirmPassword" type="password" autoComplete="new-password" minLength={10} required className={inputClass} />
      </label>
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
