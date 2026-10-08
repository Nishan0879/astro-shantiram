/**
 * Page views from the tracker in the site layout. Passes the visitor's IP and browser on
 * to the API, which turns them into an anonymous daily visitor count and keeps neither.
 */
export async function POST(request: Request) {
  const apiUrl = process.env.API_URL;
  if (!apiUrl) return new Response(null, { status: 204 });
  const body = await request.text();
  if (body.length > 2000) return new Response(null, { status: 413 });
  try {
    await fetch(`${apiUrl}/api/stats/view`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Key": process.env.INTERNAL_API_KEY ?? "",
        "X-Visitor-IP": request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "",
        "X-Visitor-UA": request.headers.get("user-agent") ?? "",
      },
      body,
    });
  } catch (err) {
    // A missed count must never bother the visitor
    console.error("Stats API unreachable", err);
  }
  return new Response(null, { status: 204 });
}
