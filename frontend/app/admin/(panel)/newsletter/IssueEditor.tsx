"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { NewsletterIssue, SendProgress } from "@/lib/newsletter";
import DeleteButton from "../../DeleteButton";
import { deleteIssue, type IssueResult, saveIssue, sendNext, sendTest } from "../../newsletter-actions";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "../../styles";

export default function IssueEditor({
  issue,
  subscribers,
  initialProgress,
  savedNotice,
}: {
  issue: NewsletterIssue | null;
  subscribers: number;
  initialProgress?: SendProgress;
  savedNotice?: boolean;
}) {
  const router = useRouter();
  const [subject, setSubject] = useState(issue?.subject ?? "");
  const [body, setBody] = useState(issue?.body ?? "");
  const [result, setResult] = useState<IssueResult | null>(savedNotice ? { notice: "Saved. Send yourself a test copy before sending to everyone." } : null);
  const [progress, setProgress] = useState<SendProgress | undefined>(initialProgress);
  const [busy, startBusy] = useTransition();
  const [sending, setSending] = useState(false);
  const changed = !issue || subject !== issue.subject || body !== issue.body;
  const status = progress?.issue.status ?? issue?.status ?? "draft";

  function save() {
    startBusy(async () => setResult(await saveIssue(issue?.id ?? null, { subject, body })));
  }

  async function sendAll() {
    if (!issue) return;
    if (!confirm(`Send "${subject}" to ${subscribers} ${subscribers === 1 ? "person" : "people"} now? This cannot be undone.`)) return;
    setSending(true);
    setResult(null);
    // A few at a time, so no single request runs too long
    for (;;) {
      const next = await sendNext(issue.id);
      if ("error" in next) {
        setResult({ error: next.error });
        break;
      }
      setProgress(next);
      if (next.issue.status === "sent" || next.remaining === 0) break;
    }
    setSending(false);
    router.refresh();
  }

  if (issue && status !== "draft") {
    const p = progress;
    const total = p?.issue.recipientCount ?? issue.recipientCount;
    const done = (p?.sent ?? 0) + (p?.failed ?? 0);
    return (
      <div className="space-y-4">
        <section className="rounded-xl border border-gold/30 bg-warm-white p-5">
          <p className="text-sm text-charcoal/60">Subject</p>
          <p className="font-medium">{issue.subject}</p>
          <p className="mt-4 whitespace-pre-wrap break-words border-t border-gold/20 pt-4">{issue.body}</p>
        </section>
        <section className="rounded-xl border border-gold/30 bg-warm-white p-5" aria-live="polite">
          {status === "sent" ? (
            <p>
              Sent to {p?.sent ?? issue.sentCount} of {total} {total === 1 ? "subscriber" : "subscribers"}.
              {p?.failed ? ` ${p.failed} could not be delivered.` : ""}
            </p>
          ) : (
            <>
              <p>
                {sending ? "Sending… keep this page open." : "Sending was interrupted. It finishes by itself once a day, or continue now."} {done} of {total} done.
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-gold/20">
                <div className="h-full bg-saffron transition-all" style={{ width: `${total ? (done / total) * 100 : 100}%` }} />
              </div>
              {!sending && (
                <button type="button" onClick={sendAll} className={`${primaryButtonClass} mt-4`}>
                  Continue sending
                </button>
              )}
            </>
          )}
          {result?.error && <p className="mt-3 text-red-700">{result.error}</p>}
        </section>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="space-y-4 rounded-xl border border-gold/30 bg-warm-white p-5"
    >
      <label className="block">
        Subject
        <input value={subject} onChange={(e) => setSubject(e.target.value)} required maxLength={200} placeholder="Dashain blessings and puja dates" className={`${inputClass} ${result?.fieldErrors?.subject ? "border-red-600" : ""}`} />
      </label>
      <label className="block">
        Message
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          rows={12}
          placeholder={"Namaste,\n\nWrite your update here. Leave a blank line between paragraphs. Links are fine.\n\nWith blessings,\nGuruji"}
          className={`${inputClass} ${result?.fieldErrors?.body ? "border-red-600" : ""}`}
        />
        <span className="mt-1 block text-xs text-charcoal/60">Sent as plain text, in whichever language you write. An unsubscribe link is added at the end.</span>
      </label>
      {result?.error && <p className="text-red-700">{result.error}</p>}
      {result?.notice && !changed && <p className="text-green-800">{result.notice}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={busy || sending || !changed} className={secondaryButtonClass}>
          {issue ? "Save changes" : "Save draft"}
        </button>
        {issue && (
          <>
            <button
              type="button"
              disabled={busy || sending || changed}
              onClick={() => startBusy(async () => setResult(await sendTest(issue.id)))}
              className={secondaryButtonClass}
            >
              Send a test to me
            </button>
            <button type="button" disabled={busy || sending || changed || subscribers === 0} onClick={sendAll} className={primaryButtonClass}>
              Send to {subscribers} {subscribers === 1 ? "subscriber" : "subscribers"}
            </button>
            <DeleteButton action={deleteIssue.bind(null, issue.id)} confirmText="Delete this draft?" />
          </>
        )}
      </div>
      {issue && changed && <p className="text-sm text-charcoal/60">Save your changes before testing or sending.</p>}
      {issue && subscribers === 0 && <p className="text-sm text-charcoal/60">Nobody has confirmed a sign-up yet, so there is no one to send to.</p>}
    </form>
  );
}
