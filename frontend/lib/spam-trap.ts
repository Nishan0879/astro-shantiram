// Server code only. The hidden fields every public form carries; see components/SpamTrap.tsx.

/** People take longer than this to fill in a form; bots post at once. */
const FASTEST_HUMAN_MS = 3000;

export type SpamTrapValues = { website?: string; startedAt?: string };

/**
 * Whether a bot filled in the form: it typed into the hidden "website" field, which people
 * never see, or it posted without the page's script or faster than a person can type.
 */
export function caughtBySpamTrap({ website, startedAt }: SpamTrapValues, now = Date.now()) {
  if (website) return true;
  const started = Number(startedAt);
  return !Number.isFinite(started) || started <= 0 || now - started < FASTEST_HUMAN_MS;
}
