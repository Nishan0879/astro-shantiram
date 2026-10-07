"use client";

import { useState, useTransition } from "react";

export type DeleteResult = { error: string } | void;

/** Asks for confirmation, then runs a server action that redirects on success or returns an error. */
export default function DeleteButton({ action, confirmText }: { action: () => Promise<DeleteResult>; confirmText: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm(confirmText)) return;
          setError(null);
          startTransition(async () => {
            const result = await action();
            if (result?.error) setError(result.error);
          });
        }}
        className="rounded-full border border-red-300 bg-white px-4 py-2 text-sm text-red-800 hover:border-red-600 disabled:opacity-60"
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      {error && <span className="text-sm text-red-700">{error}</span>}
    </span>
  );
}
