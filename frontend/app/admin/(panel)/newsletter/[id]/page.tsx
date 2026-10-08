import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { adminFetch, adminJson } from "@/lib/admin-api";
import type { NewsletterIssue, SendProgress, SubscriberCounts } from "@/lib/newsletter";
import IssueEditor from "../IssueEditor";

export const metadata: Metadata = { title: "Update" };

export default function IssuePage({ params, searchParams }: PageProps<"/admin/newsletter/[id]">) {
  return (
    <>
      <Link href="/admin/newsletter" className="text-sm hover:text-saffron">
        ← Newsletter
      </Link>
      <Suspense fallback={<p className="mt-4 text-charcoal/60">Loading…</p>}>
        <Issue params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Issue({ params, searchParams }: PageProps<"/admin/newsletter/[id]">) {
  const { id } = await params;
  const res = await adminFetch(`/api/admin/newsletter/issues/${encodeURIComponent(id)}`);
  if (res.status === 404) notFound();
  if (!res.ok) throw new Error(`Loading update failed: ${res.status}`);
  const data = (await res.json()) as Partial<SendProgress> & { issue: NewsletterIssue };
  const { counts } = await adminJson<{ counts: SubscriberCounts }>("/api/admin/newsletter");
  const progress = data.issue.status === "draft" ? undefined : (data as SendProgress);
  return (
    <>
      <h1 className="mb-4 mt-2 font-serif text-2xl text-maroon">{data.issue.status === "draft" ? "Draft update" : "Update"}</h1>
      <IssueEditor key={data.issue.id} issue={data.issue} subscribers={counts.subscribed} initialProgress={progress} savedNotice={(await searchParams).saved === "1"} />
    </>
  );
}
