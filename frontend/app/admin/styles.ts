export const inputClass =
  "mt-1 w-full rounded border border-gold/40 bg-white px-3 py-2 text-base focus:border-saffron focus:outline-none";

export const primaryButtonClass =
  "rounded-full bg-saffron px-5 py-2.5 font-medium text-white hover:bg-saffron-dark disabled:opacity-60";

export const secondaryButtonClass =
  "rounded-full border border-gold/50 bg-white px-4 py-2 text-sm hover:border-saffron disabled:opacity-60";

export const statusStyles: Record<string, string> = {
  new: "bg-saffron text-white",
  read: "bg-gold/20 text-charcoal",
  replied: "bg-green-100 text-green-900",
  archived: "bg-charcoal/10 text-charcoal/70",
};
