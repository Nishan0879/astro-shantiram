"use client";

import { useActionState } from "react";
import { login, type FormState } from "../actions";
import { inputClass, primaryButtonClass } from "../styles";

export default function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(login, {});

  return (
    <form action={action} className="space-y-4">
      {state.error && <p className="rounded bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
      <label className="block text-sm">
        Email
        <input name="email" type="email" autoComplete="username" defaultValue={state.email} required className={inputClass} />
      </label>
      <label className="block text-sm">
        Password
        <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </label>
      <button type="submit" disabled={pending} className={`${primaryButtonClass} w-full`}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
