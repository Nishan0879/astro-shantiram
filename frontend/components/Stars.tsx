/** A 1–5 rating as gold stars, read out as "4 out of 5". */
export default function Stars({ rating, label, className = "" }: { rating: number; label: string; className?: string }) {
  return (
    <span role="img" aria-label={label} className={`tracking-wider text-gold ${className}`}>
      {"★".repeat(rating)}
      <span className="text-gold/30">{"★".repeat(5 - rating)}</span>
    </span>
  );
}
