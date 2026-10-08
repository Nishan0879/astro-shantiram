import { useTranslations } from "next-intl";
import type { PublicTestimonial } from "@/lib/testimonials";
import Stars from "./Stars";

export default function TestimonialCard({ testimonial: r }: { testimonial: PublicTestimonial }) {
  const t = useTranslations("Testimonials");
  return (
    <figure className="flex h-full flex-col rounded-xl border border-gold/30 bg-warm-white p-6">
      <Stars rating={r.rating} label={t("stars", { rating: r.rating })} />
      <blockquote lang={r.locale ?? undefined} className="mt-3 flex-1 whitespace-pre-line text-lg leading-relaxed">
        “{r.message}”
      </blockquote>
      <figcaption className="mt-4 text-sm">
        <span className="font-medium text-maroon">{r.name}</span>
        {r.place && <span className="text-charcoal/70"> · {r.place}</span>}
        {r.service && <span className="block text-charcoal/60">{r.service}</span>}
      </figcaption>
    </figure>
  );
}
