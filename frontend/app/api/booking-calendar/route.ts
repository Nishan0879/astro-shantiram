import { manageApi } from "@/lib/manage-api";

/** The booking's calendar file, from the "Add to calendar" button. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const reference = params.get("ref") ?? "";
  const key = params.get("key") ?? "";
  const res = await manageApi(`${encodeURIComponent(reference.toUpperCase())}/calendar.ics?${new URLSearchParams({ key })}`);
  if (!res.ok) return new Response("This booking link is not valid.", { status: res.status === 404 ? 404 : 502 });
  return new Response(await res.text(), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": res.headers.get("content-disposition") ?? "attachment",
      "Cache-Control": "no-store",
    },
  });
}
