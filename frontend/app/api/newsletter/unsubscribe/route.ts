/** Mail apps' own "Unsubscribe" button posts here (RFC 8058 one-click), with the key in the address. */
export async function POST(request: Request) {
  const apiUrl = process.env.API_URL;
  if (!apiUrl) return new Response(null, { status: 503 });
  const query = new URL(request.url).searchParams;
  const res = await fetch(`${apiUrl}/api/newsletter/unsubscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: query.get("email") ?? "", key: query.get("key") ?? "" }),
  });
  return new Response(null, { status: res.ok ? 200 : res.status === 404 ? 404 : 502 });
}
