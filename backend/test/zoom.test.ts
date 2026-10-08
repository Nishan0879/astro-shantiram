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
import { zoomClient } from "../src/services/zoom.js";

const jwtSecret = "test-secret-that-is-at-least-32-chars";
let db: Database;
let mails: Mail[];
let token: string;
let calls: { method: string; url: string; body?: unknown }[];
let zoomDown: boolean;

// A stand-in for Zoom's API that records what the website asked for
const fakeZoomFetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input);
  const method = init?.method ?? "GET";
  calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
  if (url.startsWith("https://zoom.us/oauth/token")) {
    return Response.json({ access_token: "tok", expires_in: 3600 });
  }
  if (zoomDown) return Response.json({ message: "Invalid access token" }, { status: 401 });
  if (method === "POST") return Response.json({ id: 85012345678, join_url: "https://us06web.zoom.us/j/85012345678" }, { status: 201 });
  return new Response(null, { status: 204 });
}) as typeof fetch;

const zoom = () => zoomClient({ accountId: "acc", clientId: "id", clientSecret: "secret" }, fakeZoomFetch);
const api = (withZoom = true) =>
  createApp({
    db,
    mailer: { async send(m) { mails.push(m); } },
    corsOrigins: [],
    jwtSecret,
    now: () => new Date("2026-10-12T15:00:00Z"),
    zoom: withZoom ? zoom() : undefined,
  });
const as = (r: request.Test) => r.auth(token, { type: "bearer" });
const meetingCalls = () => calls.filter((c) => c.url.startsWith("https://api.zoom.us"));

const booking = async (values: Partial<typeof schema.appointments.$inferInsert> = {}) =>
  (
    await db
      .insert(schema.appointments)
      .values({
        reference: `AS-Z${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
        serviceName: "Kundali reading",
        kind: "consultation",
        date: "2026-10-13",
        startTime: "18:00",
        durationMinutes: 60,
        mode: "zoom",
        language: "en",
        name: "Sita Sharma",
        email: "sita@example.com",
        phone: "214-555-0100",
        ...values,
      })
      .returning()
  )[0];
const setStatus = (id: string, status: string, app = api()) =>
  as(request(app).post(`/api/admin/appointments/${id}/status`)).send({ status, notify: true });

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: "../database/migrations" });
  db = pg as unknown as Database;
}, 60_000);

beforeEach(async () => {
  await db.delete(schema.appointments);
  await db.delete(schema.users);
  mails = [];
  calls = [];
  zoomDown = false;
  const [user] = await db
    .insert(schema.users)
    .values({ email: "admin@example.com", name: "A", passwordHash: "x", role: "super_admin" })
    .returning();
  token = signToken(user.id, jwtSecret);
});

describe("Zoom meetings", () => {
  it("creates the meeting on confirm and puts the link in the email", async () => {
    const a = await booking();
    const res = await setStatus(a.id, "confirmed");
    expect(res.status).toBe(200);
    expect(res.body.zoom).toBe("A Zoom meeting was created.");
    expect(res.body.appointment).toMatchObject({
      meetingLink: "https://us06web.zoom.us/j/85012345678",
      zoomMeetingId: "85012345678",
    });
    expect(meetingCalls()).toEqual([
      {
        method: "POST",
        url: "https://api.zoom.us/v2/users/me/meetings",
        body: expect.objectContaining({
          topic: `Kundali reading with Astro Shantiram (${a.reference})`,
          start_time: "2026-10-13T18:00:00",
          timezone: "America/Chicago",
          duration: 60,
        }),
      },
    ]);
    expect(mails[0].text).toContain("Meeting link: https://us06web.zoom.us/j/85012345678");
  });

  it("moves the meeting with the booking, and deletes it on cancel", async () => {
    const a = await booking();
    await setStatus(a.id, "confirmed");
    calls = [];
    const moved = await as(request(api()).post(`/api/admin/appointments/${a.id}/reschedule`)).send({
      date: "2026-10-15",
      time: "17:30",
      notify: false,
    });
    expect(moved.status).toBe(200);
    expect(meetingCalls()).toEqual([
      expect.objectContaining({ method: "PATCH", url: "https://api.zoom.us/v2/meetings/85012345678", body: expect.objectContaining({ start_time: "2026-10-15T17:30:00" }) }),
    ]);

    calls = [];
    const cancelled = await setStatus(a.id, "cancelled");
    expect(cancelled.body.zoom).toBe("The Zoom meeting was deleted.");
    expect(cancelled.body.appointment).toMatchObject({ meetingLink: null, zoomMeetingId: null });
    expect(meetingCalls()).toEqual([expect.objectContaining({ method: "DELETE", url: "https://api.zoom.us/v2/meetings/85012345678" })]);
  });

  it("leaves bookings alone that are not on Zoom or already have a link", async () => {
    const inPerson = await booking({ mode: "in_person" });
    const pasted = await booking({ meetingLink: "https://zoom.us/j/111" });
    await setStatus(inPerson.id, "confirmed");
    await setStatus(pasted.id, "confirmed");
    expect(meetingCalls()).toEqual([]);
  });

  it("still confirms when Zoom fails, and says why", async () => {
    zoomDown = true;
    const a = await booking();
    const res = await setStatus(a.id, "confirmed");
    expect(res.body.appointment).toMatchObject({ status: "confirmed", meetingLink: null });
    expect(res.body.zoom).toContain("Zoom could not create the meeting (401): Invalid access token");
    expect(mails).toHaveLength(1);
  });

  it("does nothing when Zoom is not set up", async () => {
    const a = await booking();
    const res = await setStatus(a.id, "confirmed", api(false));
    expect(res.body.zoom).toBeUndefined();
    expect(calls).toEqual([]);
  });

  it("forgets the website's meeting when the admin pastes another link", async () => {
    const a = await booking();
    await setStatus(a.id, "confirmed");
    const same = await as(request(api()).patch(`/api/admin/appointments/${a.id}`)).send({
      meetingLink: "https://us06web.zoom.us/j/85012345678",
      adminNote: "note",
    });
    expect(same.body.appointment.zoomMeetingId).toBe("85012345678");
    const other = await as(request(api()).patch(`/api/admin/appointments/${a.id}`)).send({ meetingLink: "https://zoom.us/j/222", adminNote: "" });
    expect(other.body.appointment).toMatchObject({ meetingLink: "https://zoom.us/j/222", zoomMeetingId: null });
    const [row] = await db.select().from(schema.appointments).where(eq(schema.appointments.id, a.id));
    expect(row.zoomMeetingId).toBeNull();
  });

  it("lets the main admin check the Zoom login", async () => {
    expect((await as(request(api()).get("/api/admin/zoom"))).body).toEqual({ configured: true });
    expect((await as(request(api()).post("/api/admin/zoom/test"))).body).toEqual({ ok: true });
    expect((await as(request(api(false)).post("/api/admin/zoom/test"))).status).toBe(503);
  });
});
