const LINK = /https?:\/\/|www\.[a-z0-9-]+\.[a-z]{2,}/gi;
// Words that show up in bulk advertising and almost never in a note to an astrologer
const SALES = /\b(seo|backlinks?|crypto|bitcoin|casino|viagra|cialis|forex|loan offer|guest post|web ?design services|rank (?:your|on) google)\b/i;

/**
 * Whether a contact message looks like bulk spam. It is still saved, in the Spam folder,
 * so a real message caught by mistake can be found; Guruji is just not emailed about it.
 */
export function looksLikeSpam({ name, subject, message }: { name: string; subject: string; message: string }) {
  const links = message.match(LINK)?.length ?? 0;
  return (
    links >= 3 ||
    /https?:\/\/|www\./i.test(name) ||
    /\[url[=\]]|<a\s+href/i.test(message) ||
    (links >= 1 && SALES.test(`${subject} ${message}`))
  );
}
