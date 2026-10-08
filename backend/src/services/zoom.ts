import { SITE_TIME_ZONE } from "./booking.js";

export type ZoomMeeting = { id: string; joinUrl: string };
export type MeetingDetails = { topic: string; date: string; startTime: string; durationMinutes: number; agenda?: string };

export type Zoom = {
  createMeeting(details: MeetingDetails): Promise<ZoomMeeting>;
  moveMeeting(id: string, details: MeetingDetails): Promise<void>;
  deleteMeeting(id: string): Promise<void>;
  /** Checks the account ID, client ID and secret by asking Zoom for a token */
  checkLogin(): Promise<void>;
};

export type ZoomCredentials = { accountId: string; clientId: string; clientSecret: string; host?: string };

const API = "https://api.zoom.us/v2";

/** Why Zoom refused, in Zoom's own words where it gave some. */
async function zoomError(res: Response, what: string) {
  const body = (await res.json().catch(() => ({}))) as { message?: string; reason?: string; error?: string };
  return new Error(`Zoom could not ${what} (${res.status}): ${body.message ?? body.reason ?? body.error ?? res.statusText}`);
}

const meetingTimes = (d: MeetingDetails) => ({
  // Wall-clock time plus a time zone, so Zoom handles daylight saving
  start_time: `${d.date}T${d.startTime.slice(0, 5)}:00`,
  timezone: SITE_TIME_ZONE,
  duration: d.durationMinutes,
});

/** Zoom's Server-to-Server OAuth app: creates, moves and deletes meetings on Guruji's account. */
export function zoomClient(creds: ZoomCredentials, fetchImpl: typeof fetch = fetch): Zoom {
  let cached: { token: string; expiresAt: number } | undefined;
  const host = encodeURIComponent(creds.host || "me");

  async function token() {
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
    const res = await fetchImpl(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(creds.accountId)}`,
      {
        method: "POST",
        headers: { Authorization: `Basic ${Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64")}` },
      },
    );
    if (!res.ok) throw await zoomError(res, "sign in");
    const body = (await res.json()) as { access_token: string; expires_in: number };
    cached = { token: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
    return cached.token;
  }

  async function call(path: string, method: string, body?: unknown) {
    return fetchImpl(`${API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${await token()}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  return {
    async createMeeting(d) {
      const res = await call(`/users/${host}/meetings`, "POST", {
        topic: d.topic,
        type: 2,
        agenda: d.agenda,
        ...meetingTimes(d),
        settings: { waiting_room: true, join_before_host: false },
      });
      if (!res.ok) throw await zoomError(res, "create the meeting");
      const body = (await res.json()) as { id: number | string; join_url: string };
      return { id: String(body.id), joinUrl: body.join_url };
    },
    async moveMeeting(id, d) {
      const res = await call(`/meetings/${encodeURIComponent(id)}`, "PATCH", { topic: d.topic, ...meetingTimes(d) });
      if (!res.ok) throw await zoomError(res, "move the meeting");
    },
    async deleteMeeting(id) {
      const res = await call(`/meetings/${encodeURIComponent(id)}`, "DELETE");
      // Already gone is fine
      if (!res.ok && res.status !== 404) throw await zoomError(res, "delete the meeting");
    },
    async checkLogin() {
      cached = undefined;
      await token();
    },
  };
}
