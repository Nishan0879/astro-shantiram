import { notFound } from "next/navigation";

// Any address under a language that matches no page shows the site's own "not found" page
export default function CatchAll() {
  notFound();
}
