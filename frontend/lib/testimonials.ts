// Shared by the admin and the public site, so it must stay free of server-only imports

export type PublicTestimonial = {
  id: string;
  name: string;
  place: string | null;
  rating: number;
  service: string | null;
  message: string;
  locale: string | null;
  approvedAt: string | null;
};

export type TestimonialList = { testimonials: PublicTestimonial[]; count: number; average: number | null };

export const testimonialStatuses = ["new", "approved", "hidden", "spam"] as const;
export type TestimonialStatus = (typeof testimonialStatuses)[number];

export type AdminTestimonial = Omit<PublicTestimonial, "approvedAt"> & {
  email: string;
  status: TestimonialStatus;
  featured: boolean;
  createdAt: string;
  approvedAt: string | null;
};
