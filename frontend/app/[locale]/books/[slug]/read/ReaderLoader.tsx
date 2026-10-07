"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import type { ReaderProps } from "./Reader";

// The PDF library only runs in the browser
const Reader = dynamic(() => import("./Reader"), { ssr: false, loading: () => <Loading /> });

function Loading() {
  const t = useTranslations("Books.reader");
  return <p className="px-4 py-16 text-center text-charcoal/70">{t("loading")}</p>;
}

export default function ReaderLoader(props: ReaderProps) {
  return <Reader {...props} />;
}
