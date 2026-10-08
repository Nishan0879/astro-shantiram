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
import type { Mail } from "../src/services/mailer.js";

const jwtSecret = "test-secret-that-is-at-least-32-chars";
let db: Database;
let mails: Mail[];
let token: string;

// Monday, October 12, 2026, 10:00 AM in Dallas (CDT is UTC-5)
const now = () => new Date("2026-10-12T15:00:00Z");
const api = () =>
  createApp({ db, mailer: { async send(m) { mails.push(m); } }, corsOrigins: [], jwtSecret, notifyEmail: "guru@example.com", now });
const as = (r: request.Test) => r.auth(token, { type: "bearer" });

const visitor = { name: "Sita Sharma", email: "sita@example.com", phone: "214-555-0100", language: "ne", locale: "en" };
const book = (body: object) => request(api()).post("/api/booking").send({ ...visitor, ...body });
const availability = async (service: string, from = "2026-10-12", days = 7) =>
  (await request(api()).get(`/api/booking/availability?service=${service}&from=${from}&days=${days}`)).body;
const slotsOn = async (service: string, date: string) =>
  (await availability(service, date, 1)).days[0].slots as string[];

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: "../database/migrations" });
  db = pg as unknown as Database;
}, 60_000);

beforeEach(async () => {
  await db.delete(schema.appointments);
  await db.delete(schema.blockedDates);
  await db.update(schema.bookingSettings).set({ maxPerDay: null, bufferMinutes: 0 });
  await db.update(schema.services).set({ bookingOpen: true, durationMinutes: null });
  await db.delete(schema.users);
  mails = [];
  const [user] = await db
    .insert(schema.users)
    .values({ email: "m@example.com", name: "M", passwordHash: "x", role: "appointment_manager" })
    .returning();
  token = signToken(user.id, jwtSecret);
});

describe("open times", () => {
  it("offers the starting week's evenings, a day's notice ahead", async () => {
    const week = await availability("kundali");
    expect(week).toMatchObject({ kind: "consultation", durationMinutes: 60, earliest: "2026-10-13", today: "2026-10-12" });
    // Asking from Monday starts at the earliest bookable day instead
    expect(week.days.map((d: { date: string; slots: string[] }) => [d.date, d.slots.length])).toEqual([
      ["2026-10-13", 5],
      ["2026-10-14", 0],
      ["2026-10-15", 5],
      ["2026-10-16", 0],
      ["2026-10-17", 0],
      ["2026-10-18", 0],
      ["2026-10-19", 5],
    ]);
    expect(await slotsOn("kundali", "2026-10-13")).toEqual(["18:00", "18:30", "19:00", "19:30", "20:00"]);
  });

  it("uses the service's own length", async () => {
    await db.update(schema.services).set({ durationMinutes: 120 }).where(eq(schema.services.slug, "kundali"));
    expect(await slotsOn("kundali", "2026-10-13")).toEqual(["18:00", "18:30", "19:00"]);
  });

  it("is not offered for services that are not taking requests", async () => {
    await db.update(schema.services).set({ bookingOpen: false }).where(eq(schema.services.slug, "kundali"));
    expect((await request(api()).get("/api/booking/availability?service=kundali")).status).toBe(404);
  });
});

describe("booking", () => {
  it("books an open time once, and tells the visitor and Guruji", async () => {
    const res = await book({ service: "kundali", date: "2026-10-13", time: "18:00", mode: "zoom" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ kind: "consultation", date: "2026-10-13", time: "18:00" });
    expect(res.body.reference).toMatch(/^AS-[A-Z2-9]{6}$/);
    expect(mails.map((m) => m.to).sort()).toEqual(["guru@example.com", "sita@example.com"]);
    expect(mails.find((m) => m.to === "sita@example.com")?.text).toContain("Tuesday, October 13, 2026 at 6:00 PM (US Central)");

    expect(await slotsOn("kundali", "2026-10-13")).toEqual(["19:00", "19:30", "20:00"]);
    expect((await book({ service: "kundali", date: "2026-10-13", time: "18:30", mode: "phone" })).status).toBe(409);
    expect((await book({ service: "kundali", date: "2026-10-14", time: "18:00", mode: "phone" })).status).toBe(409);
  });

  it("checks the details", async () => {
    const res = await book({ service: "kundali", date: "2026-10-13", time: "", mode: "", name: "", phone: "1" });
    expect(res.status).toBe(400);
    expect(res.body.fieldErrors).toMatchObject({ time: "Choose a time", mode: "Choose how you would like to meet", name: "Add your name", phone: "Add a phone number" });
    // Kundali is not offered as a home visit
    expect((await book({ service: "kundali", date: "2026-10-13", time: "18:00", mode: "home_visit", address: "1 Main St" })).body.fieldErrors).toEqual({
      mode: "Choose how you would like to meet",
    });
  });

  it("keeps a day's limit and the buffer between consultations", async () => {
    await db.update(schema.bookingSettings).set({ maxPerDay: 1 });
    await book({ service: "kundali", date: "2026-10-13", time: "20:00", mode: "zoom" });
    expect(await slotsOn("kundali", "2026-10-13")).toEqual([]);
    await db.update(schema.bookingSettings).set({ maxPerDay: null, bufferMinutes: 30 });
    expect(await slotsOn("kundali", "2026-10-13")).toEqual(["18:00", "18:30"]);
  });

  it("takes puja requests for any open day, with the address for home visits", async () => {
    const missing = await book({ service: "rudrabhishek", date: "2026-10-17", time: "09:00", mode: "home_visit" });
    expect(missing.body.fieldErrors).toEqual({ address: "Add the address for the visit" });
    const res = await book({
      service: "rudrabhishek",
      date: "2026-10-17",
      time: "09:00",
      mode: "home_visit",
      address: "123 Elm St, Irving, TX",
      gotra: "Kaushik",
      familyNames: "Ram, Sita, Lav",
    });
    expect(res.status).toBe(201);
    expect(res.body.kind).toBe("puja");
    expect(mails.find((m) => m.to === "guru@example.com")?.text).toContain("Gotra: Kaushik");

    const days = (await availability("rudrabhishek", "2026-10-12", 3)).days;
    expect(days).toEqual([
      { date: "2026-10-13", open: true },
      { date: "2026-10-14", open: true },
      { date: "2026-10-15", open: true },
    ]);
  });

  it("refuses days off and days too soon or too far", async () => {
    await as(request(api()).post("/api/admin/schedule/blocked")).send({ date: "2026-10-17", reason: "Dashain" });
    expect((await book({ service: "rudrabhishek", date: "2026-10-17", time: "09:00", mode: "in_person" })).status).toBe(409);
    expect((await book({ service: "rudrabhishek", date: "2026-10-12", time: "18:00", mode: "in_person" })).status).toBe(409);
    expect((await book({ service: "rudrabhishek", date: "2027-01-12", time: "18:00", mode: "in_person" })).status).toBe(409);
    expect((await availability("kundali", "2026-10-17", 1)).days[0]).toEqual({ date: "2026-10-17", open: false, slots: [] });
  });
});

describe("admin", () => {
  it("confirms, adds a meeting link, moves and cancels a booking", async () => {
    await book({ service: "kundali", date: "2026-10-13", time: "18:00", mode: "zoom" });
    await book({ service: "kundali", date: "2026-10-13", time: "19:00", mode: "zoom" });
    mails = [];

    const list = await as(request(api()).get("/api/admin/appointments?view=requests"));
    expect(list.body.counts).toEqual({ requests: 2, today: 0 });
    const [first, second] = list.body.appointments;
    expect([first.startTime, second.startTime]).toEqual(["18:00:00", "19:00:00"]);

    const link = await as(request(api()).patch(`/api/admin/appointments/${first.id}`)).send({ meetingLink: "zoom.us/j/1", adminNote: "" });
    expect(link.body.fieldErrors).toEqual({ meetingLink: "Paste the full link, starting with https://" });
    await as(request(api()).patch(`/api/admin/appointments/${first.id}`)).send({ meetingLink: "https://zoom.us/j/123", adminNote: "Prefers Nepali" });

    const confirmed = await as(request(api()).post(`/api/admin/appointments/${first.id}/status`)).send({ status: "confirmed" });
    expect(confirmed.body.appointment.status).toBe("confirmed");
    expect(mails[0]).toMatchObject({ to: "sita@example.com", subject: expect.stringContaining("confirmed") });
    expect(mails[0].text).toContain("Meeting link: https://zoom.us/j/123");

    const clash = await as(request(api()).post(`/api/admin/appointments/${first.id}/reschedule`)).send({ date: "2026-10-13", time: "19:30" });
    expect(clash.status).toBe(409);
    // Outside the weekly hours is fine for the admin
    const moved = await as(request(api()).post(`/api/admin/appointments/${first.id}/reschedule`)).send({ date: "2026-10-14", time: "11:00", notify: false });
    expect(moved.body.appointment).toMatchObject({ status: "rescheduled", date: "2026-10-14", startTime: "11:00:00" });
    expect(mails).toHaveLength(1);
    expect(await slotsOn("kundali", "2026-10-13")).toEqual(["18:00", "20:00"]);

    await as(request(api()).post(`/api/admin/appointments/${second.id}/status`)).send({ status: "cancelled" });
    expect(await slotsOn("kundali", "2026-10-13")).toHaveLength(5);
    expect((await as(request(api()).get("/api/admin/appointments?view=upcoming"))).body.appointments).toHaveLength(1);
    expect((await as(request(api()).get("/api/admin/appointments?view=cancelled"))).body.appointments).toHaveLength(1);
  });

  it("edits the weekly hours and booking rules", async () => {
    const bad = await as(request(api()).put("/api/admin/schedule/windows")).send({ windows: [{ weekday: 6, startTime: "13:00", endTime: "10:00" }] });
    expect(bad.body.fieldErrors).toEqual({ "windows.0.endTime": "End after the start" });

    // Saturday morning with a lunch break
    const saved = await as(request(api()).put("/api/admin/schedule/windows")).send({
      windows: [
        { weekday: 6, startTime: "10:00", endTime: "12:00" },
        { weekday: 6, startTime: "13:00", endTime: "14:00" },
      ],
    });
    expect(saved.body.windows).toHaveLength(2);
    await as(request(api()).put("/api/admin/schedule/settings")).send({
      slotStepMinutes: 60,
      defaultDurationMinutes: 60,
      bufferMinutes: 0,
      maxPerDay: null,
      minNoticeHours: 24,
      maxDaysAhead: 60,
    });
    expect(await slotsOn("kundali", "2026-10-17")).toEqual(["10:00", "11:00", "13:00"]);
    expect(await slotsOn("kundali", "2026-10-13")).toEqual([]);

    const schedule = await as(request(api()).get("/api/admin/schedule"));
    expect(schedule.body.settings.slotStepMinutes).toBe(60);

    // Put the starting week back for the other tests
    await as(request(api()).put("/api/admin/schedule/windows")).send({
      windows: [
        { weekday: 1, startTime: "17:00", endTime: "20:00" },
        { weekday: 2, startTime: "18:00", endTime: "21:00" },
        { weekday: 4, startTime: "17:00", endTime: "20:00" },
      ],
    });
    await db.update(schema.bookingSettings).set({ slotStepMinutes: 30 });
  });

  it("is only for people who manage appointments", async () => {
    const [editor] = await db
      .insert(schema.users)
      .values({ email: "c@example.com", name: "C", passwordHash: "x", role: "content_admin" })
      .returning();
    token = signToken(editor.id, jwtSecret);
    expect((await as(request(api()).get("/api/admin/appointments"))).status).toBe(403);
    expect((await request(api()).get("/api/admin/schedule")).status).toBe(401);
  });
});
