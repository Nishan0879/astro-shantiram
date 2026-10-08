import type { Metadata } from "next";
import Link from "next/link";
import IssueEditor from "../IssueEditor";

export const metadata: Metadata = { title: "Write an update" };

export default function NewIssuePage() {
  return (
    <>
      <Link href="/admin/newsletter" className="text-sm hover:text-saffron">
        ← Newsletter
      </Link>
      <h1 className="mb-4 mt-2 font-serif text-2xl text-maroon">Write an update</h1>
      <IssueEditor issue={null} subscribers={0} />
    </>
  );
}
