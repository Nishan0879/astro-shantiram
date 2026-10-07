"use client";

import { useTransition } from "react";

/** Asks for confirmation, then runs a server action (which should redirect). */
export default function DeleteButton({ action, confirmText }: { action: () => Promise<void>; confirmText: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm(confirmText)) startTransition(() => action());
      }}
      className="rounded-full border border-red-300 bg-white px-4 py-2 text-sm text-red-800 hover:border-red-600 disabled:opacity-60"
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
