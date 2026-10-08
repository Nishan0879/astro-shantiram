import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import Stars from "@/components/Stars";
import { adminFetch, formatDate } from "@/lib/admin-api";
import { type AdminTestimonial, type TestimonialStatus, testimonialStatuses } from "@/lib/testimonials";
import DeleteButton from "../../DeleteButton";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "../../styles";
import { deleteTestimonial, editTestimonial, setTestimonialFeatured, setTestimonialStatus } from "../../testimonial-actions";

export const metadata: Metadata = { title: "Reviews" };

const tabNames: Record<TestimonialStatus, string> = { new: "Waiting", approved: "On the website", hidden: "Hidden", spam: "Spam" };

export default function TestimonialsPage({ searchParams }: PageProps<"/admin/testimonials">) {
  return (
    <>
      <h1 className="font-serif text-2xl text-maroon">Reviews</h1>
      <p className="mb-4 mt-1 text-sm text-charcoal/70">
        Reviews visitors send from the Reviews page. They show on the website only after you approve them.
      </p>
      <Suspense fallback={<p className="text-charcoal/60">Loading…</p>}>
        <List searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function List({ searchParams }: Pick<PageProps<"/admin/testimonials">, "searchParams">) {
  const asked = (await searchParams).status;
  const status = testimonialStatuses.find((s) => s === asked) ?? "new";
  const res = await adminFetch(`/api/admin/testimonials?status=${status}`);
  if (res.status === 403) return <p>Your account cannot manage reviews.</p>;
  if (!res.ok) throw new Error(`Loading reviews failed: ${res.status}`);
  const { testimonials, counts } = (await res.json()) as { testimonials: AdminTestimonial[]; counts: Record<TestimonialStatus, number> };

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {testimonialStatuses.map((s) => (
          <Link
            key={s}
            href={`/admin/testimonials?status=${s}`}
            className={`rounded-full border px-3 py-1 ${s === status ? "border-saffron bg-saffron text-white" : "border-gold/40 bg-white"}`}
          >
            {tabNames[s]} ({counts[s]})
          </Link>
        ))}
      </div>

      {testimonials.length === 0 ? (
        <p className="rounded-xl border border-gold/30 bg-warm-white p-6 text-charcoal/70">
          {status === "new" ? "No reviews waiting. New ones show up here and you get an email." : "Nothing here."}
        </p>
      ) : (
        <ul className="space-y-4">
          {testimonials.map((r) => (
            <li key={r.id} className={`rounded-xl border bg-warm-white p-5 ${r.featured ? "border-saffron" : "border-gold/30"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Stars rating={r.rating} label={`${r.rating} out of 5 stars`} className="text-xl" />
                <span className="text-xs text-charcoal/60">
                  {r.featured && <span className="mr-2 rounded-full bg-saffron px-2 py-0.5 text-white">Featured</span>}
                  {formatDate(r.createdAt)}
                </span>
              </div>
              <p lang={r.locale ?? undefined} className="mt-2 whitespace-pre-line">
                {r.message}
              </p>
              <p className="mt-3 text-sm">
                <span className="font-medium">{r.name}</span>
                {r.place && <span className="text-charcoal/70"> · {r.place}</span>}
                {r.service && <span className="text-charcoal/70"> · {r.service}</span>}
                <br />
                <a href={`mailto:${r.email}`} className="break-all text-saffron-dark underline">
                  {r.email}
                </a>{" "}
                <span className="text-xs text-charcoal/60">(only you see this)</span>
              </p>

              <div className="mt-4 flex flex-wrap items-start gap-2 border-t border-gold/20 pt-4">
                {r.status !== "approved" && (
                  <form action={setTestimonialStatus.bind(null, r.id, "approved")}>
                    <button type="submit" className={primaryButtonClass}>
                      Show on website
                    </button>
                  </form>
                )}
                {r.status === "approved" && (
                  <form action={setTestimonialFeatured.bind(null, r.id, !r.featured)}>
                    <button type="submit" className={secondaryButtonClass}>
                      {r.featured ? "Stop featuring" : "Feature on home page"}
                    </button>
                  </form>
                )}
                {r.status !== "hidden" && (
                  <form action={setTestimonialStatus.bind(null, r.id, "hidden")}>
                    <button type="submit" className={secondaryButtonClass}>
                      Hide
                    </button>
                  </form>
                )}
                {r.status !== "spam" && r.status !== "approved" && (
                  <form action={setTestimonialStatus.bind(null, r.id, "spam")}>
                    <button type="submit" className={secondaryButtonClass}>
                      Spam
                    </button>
                  </form>
                )}
                <DeleteButton action={deleteTestimonial.bind(null, r.id)} confirmText="Delete this review for good? This cannot be undone." />
              </div>

              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-charcoal/70 hover:text-saffron">Fix a typo or shorten the name</summary>
                <form action={editTestimonial.bind(null, r.id)} className="mt-3 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="block">
                      Name
                      <input name="name" required maxLength={80} defaultValue={r.name} className={inputClass} />
                    </label>
                    <label className="block">
                      City and state
                      <input name="place" maxLength={80} defaultValue={r.place ?? ""} className={inputClass} />
                    </label>
                    <label className="block">
                      Service
                      <input name="service" maxLength={120} defaultValue={r.service ?? ""} className={inputClass} />
                    </label>
                  </div>
                  <label className="block">
                    Review
                    <textarea name="message" required rows={4} maxLength={1500} defaultValue={r.message} className={inputClass} />
                  </label>
                  <button type="submit" className={secondaryButtonClass}>
                    Save changes
                  </button>
                </form>
              </details>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
