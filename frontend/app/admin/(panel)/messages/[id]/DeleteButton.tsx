"use client";

import { useTransition } from "react";
import { deleteMessage } from "@/app/admin/actions";

export default function DeleteButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm("Delete this message for good? This cannot be undone.")) {
          startTransition(() => deleteMessage(id));
        }
      }}
      className="rounded-full border border-red-300 bg-white px-4 py-2 text-sm text-red-800 hover:border-red-600 disabled:opacity-60"
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
