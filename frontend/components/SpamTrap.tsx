"use client";

import { useEffect, useRef } from "react";

// When this page's script loaded, so the booking form, which appears only after a time
// is picked, still counts the time spent choosing
const pageReady = String(Date.now());

/**
 * Two hidden fields that catch spam bots without a puzzle for people: a "website" box that
 * only bots fill in, and the time the page was ready, so instant posts can be told apart.
 */
export default function SpamTrap() {
  const startedAt = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const form = startedAt.current?.form;
    if (!form) return;
    // Added as the form is sent rather than kept in the field, because React clears the
    // fields after a send, and a person fixing a mistake would then look like a bot
    const add = (e: FormDataEvent) => e.formData.set("startedAt", pageReady);
    form.addEventListener("formdata", add);
    return () => form.removeEventListener("formdata", add);
  }, []);
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
      <label>
        Website
        <input name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
      <input ref={startedAt} name="startedAt" type="hidden" defaultValue="" />
    </div>
  );
}

/** For forms kept in React state: reads the same two fields from the form element. */
export function spamTrapValues(form: HTMLFormElement) {
  const data = new FormData(form);
  return { website: String(data.get("website") ?? ""), startedAt: String(data.get("startedAt") ?? "") };
}
