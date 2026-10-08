import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/create-app.js";
import type { Database } from "../src/db/client.js";
import * as schema from "../src/db/schema.js";
import { signToken } from "../src/services/auth.js";
import { bookingIcs, centralToUtc, manageKey } from "../src/services/booking-links.js";
import type { Mail } from "../src/services/mailer.js";
import type { Zoom } from "../src/services/zoom.js";

const jwtSecret = "test-secret-that-is-at-least-32-chars";
let db: Database;
let mails: Mail[];
let zoomCalls: string[];
let token: string;

// Monday, October 12, 2026, 10:00 AM in Dallas
let at = new Date("2026-10-12T15:00:00Z");
const fakeZoom: Zoom = {
  async createMeeting() {
    zoomCalls.push("create");
    return { id: "850", joinUrl: "https://us06web.zoom.us/j/850" };
  },
  async moveMeeting(id, d) {
    zoomCalls.push(`move ${id} ${d.date} ${d.startTime}`);
  },
  async deleteMeeting(id) {
    zoomCalls.push(`delete ${id}`);
  },
  async checkLogin() {},
};
const api = () =>
  createApp({
    db,
    mailer: { async send(m) { mails.push(m); } },
    corsOrigins: [],
    jwtSecret,
    notifyEmail: "guru@example.com",
    now: () => at,
    zoom: fakeZoom,
    siteUrl: "https://example.org",
  });

const visitor = { name: "Sita Sharma", email: "sita@example.com", phone: "214-555-0100", language: "ne", locale: "ne" };
async function book(body: object) {
  const res = await request(api()).post("/api/booking").send({ ...visitor, ...body });
  expect(res.status).toBe(201);
  mails = [];
  return res.body as { reference: string; manageKey: string };
}
const manage = (ref: string, key: string, path = "") => request(api()).get(`/api/booking/manage/${ref}${path}${path.includes("?") ? "&" : "?"}key=${key}`);
const post = (ref: string, action: string, body: object) => request(api()).post(`/api/booking/manage/${ref}/${action}`).send(body);
const confirm = (ref: string) =>
  db.select().from(schema.appointments).where(eq(schema.appointments.reference, ref)).then(async ([a]) =>
    request(api()).post(`/api/admin/appointments/${a.id}/status`).auth(token, { type: "bearer" }).send({ status: "confirmed" }),
  );

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: "../database/migrations" });
  db = pg as unknown as Database;
}, 60_000);

beforeEach(async () => {
  at = new Date("2026-10-12T15:00:00Z");
  await db.delete(schema.appointments);
  await db.delete(schema.blockedDates);
  await db.update(schema.bookingSettings).set({ maxPerDay: null, bufferMinutes: 0 });
  await db.update(schema.services).set({ bookingOpen: true, durationMinutes: null });
  await db.delete(schema.users);
  mails = [];
  zoomCalls = [];
  const [user] = await db
    .insert(schema.users)
    .values({ email: "m@example.com", name: "M", passwordHash: "x", role: "appointment_manager" })
    .returning();
  token = signToken(user.id, jwtSecret);
});

describe("the manage link", () => {
  it("is in the customer's emails and opens only with the right key", async () => {
    const res = await request(api()).post("/api/booking").send({ ...visitor, service: "kundali", date: "2026-10-13", time: "18:00", mode: "zoom" });
    const { reference, manageKey: key } = res.body;
    expect(key).toBe(manageKey(jwtSecret, reference));
    const toSita = mails.find((m) => m.to === "sita@example.com")!;
    expect(toSita.text).toContain(`https://example.org/ne/book/manage?ref=${reference}&key=${key}`);
    // Guruji's copy carries no customer link
    expect(mails.find((m) => m.to === "guru@example.com")!.text).not.toContain("book/manage");

    const seen = await manage(reference, key);
    expect(seen.status).toBe(200);
    expect(seen.body.booking).toMatchObject({
      reference,
      date: "2026-10-13",
      time: "18:00",
      status: "requested",
      canChange: true,
      start: "2026-10-13T23:00:00.000Z",
      end: "2026-10-14T00:00:00.000Z",
    });
    expect(seen.body.booking).not.toHaveProperty("adminNote");
    expect(seen.body.booking).not.toHaveProperty("phone");
    expect((await manage(reference, "x".repeat(32))).status).toBe(404);
    expect((await manage(reference, "")).status).toBe(404);
    expect((await manage("AS-NOPE22", key)).status).toBe(404);
  });

  it("is attached as a calendar file to the confirmation", async () => {
    const { reference, manageKey: key } = await book({ service: "kundali", date: "2026-10-13", time: "18:00", mode: "phone" });
    await confirm(reference);
    const confirmation = mails.find((m) => m.subject.startsWith("Your booking is confirmed"))!;
    expect(confirmation.text).toContain("/ne/book/manage?ref=");
    expect(confirmation.attachments?.[0]).toMatchObject({ filename: `astro-shantiram-${reference}.ics`, contentType: "text/calendar; charset=utf-8" });
    expect(confirmation.attachments?.[0].content).toContain("DTSTART:20261013T230000Z");

    const ics = await manage(reference, key, "/calendar.ics");
    expect(ics.status).toBe(200);
    expect(ics.headers["content-type"]).toContain("text/calendar");
    expect(ics.text).toContain(`UID:${reference}@astro-shantiram`);
  });

  it("shows the admin the link to pass on", async () => {
    const { reference, manageKey: key } = await book({ service: "kundali", date: "2026-10-13", time: "18:00", mode: "phone" });
    const [a] = await db.select().from(schema.appointments);
    const res = await request(api()).get(`/api/admin/appointments/${a.id}`).auth(token, { type: "bearer" });
    expect(res.body.manageUrl).toBe(`https://example.org/ne/book/manage?ref=${reference}&key=${key}`);
  });
});

describe("cancelling", () => {
  it("cancels, deletes the Zoom meeting, and tells both sides", async () => {
    const { reference, manageKey: key } = await book({ service: "kundali", date: "2026-10-13", time: "18:00", mode: "zoom" });
    await confirm(reference);
    mails = [];
    expect((await post(reference, "cancel", { key: "wrong" })).status).toBe(404);
    const res = await post(reference, "cancel", { key });
    expect(res.status).toBe(200);
    expect(res.body.booking).toMatchObject({ status: "cancelled", canChange: false, meetingLink: null });
    expect(zoomCalls).toEqual(["create", "delete 850"]);
    expect(mails.map((m) => m.subject).sort()).toEqual([
      `Your booking is cancelled (${reference})`,
      `[Astro Shantiram] Sita Sharma cancelled their booking (${reference})`,
    ]);
    // The time is free again
    const open = await request(api()).get("/api/booking/availability?service=kundali&from=2026-10-13&days=1");
    expect(open.body.days[0].slots).toContain("18:00");
    expect((await post(reference, "cancel", { key })).status).toBe(409);
  });

  it("is closed inside the notice period", async () => {
    const { reference, manageKey: key } = await book({ service: "kundali", date: "2026-10-13", time: "18:00", mode: "phone" });
    // Monday 7:00 PM: under a day before Tuesday 6:00 PM
    at = new Date("2026-10-13T00:00:00Z");
    expect((await manage(reference, key)).body.booking.canChange).toBe(false);
    expect((await post(reference, "cancel", { key })).body).toEqual({ error: "too_late" });
  });
});

describe("moving", () => {
  it("offers open times, counting its own time as free", async () => {
    const { reference, manageKey: key } = await book({ service: "kundali", date: "2026-10-13", time: "18:00", mode: "phone" });
    await book({ service: "kundali", date: "2026-10-13", time: "20:00", mode: "phone" });
    const res = await manage(reference, key, "/availability?from=2026-10-13&days=1");
    expect(res.body.days[0].slots).toEqual(["18:00", "18:30", "19:00"]);
  });

  it("moves a confirmed consultation, keeps it booked, and moves the Zoom meeting", async () => {
    const { reference, manageKey: key } = await book({ service: "kundali", date: "2026-10-13", time: "18:00", mode: "zoom" });
    await confirm(reference);
    await db.update(schema.appointments).set({ reminderSentAt: new Date() });
    mails = [];
    const res = await post(reference, "move", { key, date: "2026-10-15", time: "19:00" });
    expect(res.status).toBe(200);
    expect(res.body.booking).toMatchObject({ date: "2026-10-15", time: "19:00", status: "rescheduled" });
    expect(zoomCalls).toEqual(["create", "move 850 2026-10-15 19:00:00"]);
    const [row] = await db.select().from(schema.appointments);
    expect(row.reminderSentAt).toBeNull();
    const toSita = mails.find((m) => m.to === "sita@example.com")!;
    expect(toSita.text).toContain("Thursday, October 15, 2026 at 7:00 PM");
    expect(toSita.attachments).toHaveLength(1);
    expect(mails.find((m) => m.to === "guru@example.com")!.text).toContain("It was: Tuesday, October 13, 2026 at 6:00 PM");
  });

  it("refuses times that are not open", async () => {
    const { reference, manageKey: key } = await book({ service: "kundali", date: "2026-10-13", time: "18:00", mode: "phone" });
    await book({ service: "kundali", date: "2026-10-15", time: "18:00", mode: "phone" });
    expect((await post(reference, "move", { key, date: "2026-10-15", time: "18:30" })).status).toBe(409);
    expect((await post(reference, "move", { key, date: "2026-10-14", time: "18:00" })).status).toBe(409);
    expect((await post(reference, "move", { key, date: "2026-10-15", time: "nope" })).status).toBe(400);
  });

  it("sends a moved puja back for Guruji to arrange", async () => {
    const { reference, manageKey: key } = await book({ service: "rudrabhishek", date: "2026-10-17", time: "09:00", mode: "in_person" });
    await confirm(reference);
    const res = await post(reference, "move", { key, date: "2026-10-18", time: "10:15" });
    expect(res.body.booking).toMatchObject({ date: "2026-10-18", time: "10:15", status: "requested" });
    expect(mails.find((m) => m.subject.startsWith("Your booking has a new time"))?.attachments).toBeUndefined();
  });
});

describe("calendar times", () => {
  it("turns Central wall-clock times into real moments across daylight saving", () => {
    expect(centralToUtc("2026-10-13", "18:00").toISOString()).toBe("2026-10-13T23:00:00.000Z");
    expect(centralToUtc("2026-12-01", "18:00").toISOString()).toBe("2026-12-02T00:00:00.000Z");
    expect(centralToUtc("2026-11-01", "09:00").toISOString()).toBe("2026-11-01T15:00:00.000Z");
    expect(centralToUtc("2027-03-14", "09:00").toISOString()).toBe("2027-03-14T14:00:00.000Z");
  });

  it("escapes and folds calendar text", async () => {
    const { reference } = await book({ service: "kundali", date: "2026-10-13", time: "18:00", mode: "phone" });
    const [a] = await db.select().from(schema.appointments).where(eq(schema.appointments.reference, reference));
    const ics = bookingIcs({ ...a, serviceName: "Kundali, chart; reading" }, `https://example.org/${"x".repeat(100)}`);
    expect(ics).toContain("SUMMARY:Kundali\\, chart\\; reading with Astro Shantiram");
    expect(ics.split("\r\n").every((l) => Buffer.byteLength(l) <= 75)).toBe(true);
  });
});
