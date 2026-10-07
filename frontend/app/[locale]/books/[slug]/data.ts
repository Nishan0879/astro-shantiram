import type { PublicBook } from "@/lib/books";
import { publicJson } from "@/lib/public-api";

export async function getBook(slug: string, locale: string) {
  const data = await publicJson<{ book: PublicBook }>(`/api/books/${encodeURIComponent(slug)}?locale=${locale}`);
  return data?.book ?? null;
}
