"use client";

import { useState, useTransition } from "react";
import {
  type ActionResult,
  addBlockedDate,
  removeBlockedDate,
  saveBookingSettings,
  saveWindows,
  type SettingsValues,
  type WindowValues,
} from "@/app/admin/appointment-actions";
import { wallClock } from "@/lib/booking";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "../../styles";

const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function Feedback({ result }: { result: ActionResult }) {
  if (result.error) return <p className="rounded bg-red-50 p-3 text-sm text-red-800">{result.error}</p>;
  if (result.ok) return <p className="rounded bg-green-50 p-3 text-sm text-green-900">Saved.</p>;
  return null;
}

/** Weekly hours: each day can have several windows, which leaves breaks between them. */
export function WeeklyHours({ initial }: { initial: WindowValues[] }) {
  const [windows, setWindows] = useState(initial);
  const [result, setResult] = useState<ActionResult>({});
  const [pending, startTransition] = useTransition();
  const update = (i: number, patch: Partial<WindowValues>) => {
    setWindows((w) => w.map((x, j) => (j === i ? { ...x, ...patch } : x)));
    setResult({});
  };

  return (
    <div className="space-y-3">
      <Feedback result={result} />
      <ul className="divide-y divide-gold/20 rounded-lg border border-gold/30">
        {weekdays.map((name, weekday) => {
          const own = windows.map((w, i) => ({ ...w, i })).filter((w) => w.weekday === weekday);
          return (
            <li key={name} className="p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{name}</span>
                <button
                  type="button"
                  onClick={() => setWindows((w) => [...w, { weekday, startTime: own.at(-1)?.endTime ?? "17:00", endTime: "20:00" }])}
                  className="text-sm text-saffron-dark underline"
                >
                  {own.length ? "Add hours" : "Open this day"}
                </button>
              </div>
              {own.length === 0 && <p className="text-sm text-charcoal/60">Closed</p>}
              {own.map((w) => {
                const problem = result.fieldErrors?.[`windows.${w.i}.endTime`];
                return (
                  <div key={w.i} className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                    <input type="time" step={900} value={w.startTime} onChange={(e) => update(w.i, { startTime: e.target.value })} aria-label={`${name} from`} className={`${inputClass} mt-0 w-32`} />
                    <span>to</span>
                    <input
                      type="time"
                      step={900}
                      value={w.endTime}
                      onChange={(e) => update(w.i, { endTime: e.target.value })}
                      aria-label={`${name} until`}
                      className={`${inputClass} mt-0 w-32 ${problem ? "border-red-600" : ""}`}
                    />
                    <button type="button" onClick={() => setWindows((x) => x.filter((_, j) => j !== w.i))} className="text-red-800 underline">
                      Remove
                    </button>
                    {problem && <span className="w-full text-red-700">The end must be after the start.</span>}
                  </div>
                );
              })}
            </li>
          );
        })}
      </ul>
      <button type="button" disabled={pending} onClick={() => startTransition(async () => setResult(await saveWindows(windows)))} className={primaryButtonClass}>
        {pending ? "Saving…" : "Save weekly hours"}
      </button>
    </div>
  );
}

const numberFields: { key: keyof SettingsValues; label: string; hint: string; min: number }[] = [
  { key: "defaultDurationMinutes", label: "Default length (minutes)", hint: "Used when a service has no length set.", min: 5 },
  { key: "slotStepMinutes", label: "Start times every (minutes)", hint: "30 offers 5:00, 5:30, 6:00…", min: 5 },
  { key: "bufferMinutes", label: "Break between consultations (minutes)", hint: "0 for back to back.", min: 0 },
  { key: "minNoticeHours", label: "Book at least (hours ahead)", hint: "24 means no same-day bookings.", min: 0 },
  { key: "maxDaysAhead", label: "Book at most (days ahead)", hint: "How far ahead the calendar opens.", min: 1 },
];

export function BookingRules({ initial }: { initial: SettingsValues }) {
  const [values, setValues] = useState(initial);
  const [result, setResult] = useState<ActionResult>({});
  const [pending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => setResult(await saveBookingSettings(values)));
      }}
      className="space-y-3"
    >
      <Feedback result={result} />
      <div className="grid gap-4 sm:grid-cols-2">
        {numberFields.map(({ key, label, hint, min }) => (
          <label key={key} className="block text-sm">
            {label}
            <input
              type="number"
              inputMode="numeric"
              min={min}
              required
              value={values[key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [key]: Math.max(min, Math.floor(Number(e.target.value) || 0)) }))}
              className={`${inputClass} ${result.fieldErrors?.[key] ? "border-red-600" : ""}`}
            />
            <span className="mt-1 block text-xs text-charcoal/60">{hint}</span>
          </label>
        ))}
        <label className="block text-sm">
          Most bookings in one day
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={values.maxPerDay ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, maxPerDay: e.target.value === "" ? null : Math.max(1, Math.floor(Number(e.target.value) || 1)) }))}
            className={inputClass}
          />
          <span className="mt-1 block text-xs text-charcoal/60">Leave empty for no limit.</span>
        </label>
      </div>
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Saving…" : "Save booking rules"}
      </button>
    </form>
  );
}

export function DaysOff({ blocked, today }: { blocked: { date: string; reason: string | null }[]; today: string }) {
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<ActionResult>({});
  const [pending, startTransition] = useTransition();
  const label = (d: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "full", timeZone: "UTC" }).format(wallClock(d));

  return (
    <div className="space-y-3">
      <Feedback result={result} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const res = await addBlockedDate(date, reason);
            setResult(res);
            if (res.ok) {
              setDate("");
              setReason("");
            }
          });
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <label className="text-sm">
          Day
          <input type="date" min={today} required value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </label>
        <label className="min-w-48 flex-1 text-sm">
          Reason (optional, only admins see it)
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="Dashain, travel…" className={inputClass} />
        </label>
        <button type="submit" disabled={pending} className={secondaryButtonClass}>
          Block this day
        </button>
      </form>
      {blocked.length === 0 ? (
        <p className="text-sm text-charcoal/60">No days off coming up.</p>
      ) : (
        <ul className="divide-y divide-gold/20 rounded-lg border border-gold/30">
          {blocked.map((b) => (
            <li key={b.date} className="flex items-center justify-between gap-3 p-3 text-sm">
              <span>
                {label(b.date)}
                {b.reason && <span className="text-charcoal/60"> · {b.reason}</span>}
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(async () => setResult(await removeBlockedDate(b.date)))}
                className="text-red-800 underline"
              >
                Open again
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
