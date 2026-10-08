"use client";

import { useState, useTransition } from "react";
import { checkZoomLogin, type ZoomCheckResult } from "../../email-actions";
import { secondaryButtonClass } from "../../styles";

export default function ZoomCheckButton() {
  const [result, setResult] = useState<ZoomCheckResult>({});
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={pending}
        className={secondaryButtonClass}
        onClick={() => startTransition(async () => setResult(await checkZoomLogin()))}
      >
        {pending ? "Checking…" : "Check Zoom login"}
      </button>
      {result.ok && <p className="rounded bg-green-50 p-3 text-sm text-green-900">Zoom accepted the login.</p>}
      {result.error && <p className="rounded bg-red-50 p-3 text-sm text-red-800">{result.error}</p>}
    </div>
  );
}
