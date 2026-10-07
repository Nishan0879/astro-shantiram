/** Fetches from the API for public pages. Returns null for a 404. */
export async function publicJson<T>(path: string): Promise<T | null> {
  const base = process.env.API_URL;
  if (!base) throw new Error("API_URL is not set");
  const res = await fetch(`${base}${path}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API ${path} responded ${res.status}`);
  return res.json() as Promise<T>;
}
