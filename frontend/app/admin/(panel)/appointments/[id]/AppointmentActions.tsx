"use client";

import { useState, useTransition } from "react";
import {
  type ActionResult,
  rescheduleAppointment,
  saveAppointmentNotes,
  setAppointmentStatus,
} from "@/app/admin/appointment-actions";
import type { Appointment } from "@/lib/booking";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "../../../styles";

type Status = "confirmed" | "cancelled" | "completed" | "no_show";

export default function AppointmentActions({ appointment: a, isPast }: { appointment: Appointment; isPast: boolean }) {
  const [notify, setNotify] = useState(true);
  const [moving, setMoving] = useState(false);
  const [date, setDate] = useState(a.date);
  const [time, setTime] = useState(a.startTime.slice(0, 5));
  const [meetingLink, setMeetingLink] = useState(a.meetingLink ?? "");
  // Confirming can add a Zoom link (or cancelling remove it); show the new one
  const [linkFromServer, setLinkFromServer] = useState(a.meetingLink);
  if (a.meetingLink !== linkFromServer) {
    setLinkFromServer(a.meetingLink);
    setMeetingLink(a.meetingLink ?? "");
  }
  const [adminNote, setAdminNote] = useState(a.adminNote ?? "");
  const [result, setResult] = useState<ActionResult & { what?: string }>({});
  const [pending, startTransition] = useTransition();

  const run = (what: string, action: () => Promise<ActionResult>) =>
    startTransition(async () => {
      const res = await action();
      setResult({ ...res, what });
      if (res.ok && what === "moved") setMoving(false);
    });
  const status = (s: Status, label: string, confirmText?: string) => (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirmText && !confirm(confirmText)) return;
        run(label, () => setAppointmentStatus(a.id, s, notify));
      }}
      className={s === "confirmed" ? primaryButtonClass : secondaryButtonClass}
    >
      {label}
    </button>
  );
  const active = a.status === "requested" || a.status === "confirmed" || a.status === "rescheduled";
  const err = (f: string) => result.fieldErrors?.[f];

  return (
    <div className="space-y-6">
      {result.error && <p className="rounded bg-red-50 p-3 text-sm text-red-800">{result.error}</p>}
      {result.ok && <p className="rounded bg-green-50 p-3 text-sm text-green-900">Saved.</p>}
      {result.notice && (
        <p
          className={`rounded p-3 text-sm ${result.notice.startsWith("Zoom problem") ? "bg-red-50 text-red-800" : "bg-green-50 text-green-900"}`}
        >
          {result.notice}
        </p>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {a.status === "requested" && status("confirmed", "Confirm")}
          {active && isPast && status("completed", "Mark completed")}
          {active && isPast && status("no_show", "No show")}
          {active && !moving && (
            <button type="button" disabled={pending} onClick={() => setMoving(true)} className={secondaryButtonClass}>
              Move to another time
            </button>
          )}
          {active && status("cancelled", a.status === "requested" ? "Decline" : "Cancel booking", "Cancel this booking? The time becomes free for others.")}
          {!active && a.status !== "requested" && status("confirmed", "Reopen as confirmed")}
        </div>
        {moving && (
          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gold/30 p-3">
            <label className="text-sm">
              New day
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${inputClass} ${err("date") ? "border-red-600" : ""}`} />
            </label>
            <label className="text-sm">
              New time (US Central)
              <input type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} className={`${inputClass} ${err("time") ? "border-red-600" : ""}`} />
            </label>
            <button type="button" disabled={pending} onClick={() => run("moved", () => rescheduleAppointment(a.id, date, time, notify))} className={primaryButtonClass}>
              Save new time
            </button>
            <button type="button" onClick={() => setMoving(false)} className="text-sm underline">
              Never mind
            </button>
            {(err("time") || err("date")) && <p className="w-full text-sm text-red-700">{err("time") ?? err("date")}</p>}
          </div>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="h-4 w-4 accent-saffron" />
          Email {a.name} when I confirm, move or cancel
        </label>
      </section>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          run("notes", () => saveAppointmentNotes(a.id, meetingLink, adminNote));
        }}
        className="space-y-3 border-t border-gold/20 pt-4"
      >
        <label className="block text-sm">
          Meeting link (optional)
          <span className="block text-xs text-charcoal/60">
            {a.mode === "zoom"
              ? "When Zoom is set up, confirming makes the meeting and adds its link here. Or paste your own link before confirming."
              : "Paste a link here before confirming, so it is in the confirmation email."}
          </span>
          <input
            value={meetingLink}
            onChange={(e) => setMeetingLink(e.target.value)}
            placeholder="https://zoom.us/j/…"
            className={`${inputClass} ${err("meetingLink") ? "border-red-600" : ""}`}
          />
          {err("meetingLink") && <span className="text-red-700">{err("meetingLink")}</span>}
        </label>
        <label className="block text-sm">
          Private note (only admins see this)
          <textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} rows={3} maxLength={5000} className={inputClass} />
        </label>
        <button type="submit" disabled={pending} className={secondaryButtonClass}>
          {pending ? "Saving…" : "Save link and note"}
        </button>
      </form>
    </div>
  );
}
