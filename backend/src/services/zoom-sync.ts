import { eq } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { type Appointment, appointments } from "../db/schema.js";
import type { Zoom } from "./zoom.js";

/**
 * Keeps the website-made Zoom meeting in step with the booking: makes one when a Zoom
 * booking is confirmed without a link, moves it with the booking, and deletes it on cancel.
 * Zoom trouble never blocks the booking change; the admin sees a note instead.
 */
export async function syncZoom(db: Database, zoom: Zoom | undefined, a: Appointment): Promise<{ appointment: Appointment; zoom?: string }> {
  if (!zoom || a.mode !== "zoom") return { appointment: a };
  const details = {
    topic: `${a.serviceName} with Astro Shantiram (${a.reference})`,
    date: a.date,
    startTime: a.startTime,
    durationMinutes: a.durationMinutes,
    agenda: `Booking ${a.reference} for ${a.name}`,
  };
  const save = async (values: Partial<Appointment>) =>
    (await db.update(appointments).set(values).where(eq(appointments.id, a.id)).returning())[0];
  try {
    if (a.status === "cancelled") {
      if (!a.zoomMeetingId) return { appointment: a };
      await zoom.deleteMeeting(a.zoomMeetingId);
      return { appointment: await save({ zoomMeetingId: null, meetingLink: null }), zoom: "The Zoom meeting was deleted." };
    }
    if (a.status !== "confirmed" && a.status !== "rescheduled") return { appointment: a };
    if (a.zoomMeetingId) {
      await zoom.moveMeeting(a.zoomMeetingId, details);
      return { appointment: a };
    }
    // A link the admin pasted themselves is left alone
    if (a.meetingLink) return { appointment: a };
    const meeting = await zoom.createMeeting(details);
    return { appointment: await save({ zoomMeetingId: meeting.id, meetingLink: meeting.joinUrl }), zoom: "A Zoom meeting was created." };
  } catch (err) {
    console.error("Zoom update failed", a.reference, err);
    const detail = err instanceof Error ? err.message : "Unknown error";
    return { appointment: a, zoom: `Zoom problem: ${detail.slice(0, 300)}. You can paste a meeting link by hand below.` };
  }
}
