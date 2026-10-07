"use client";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { useTranslations } from "next-intl";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Link } from "@/i18n/navigation";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();

export type ReaderProps = { slug: string; title: string; titleLocale: string; pdfUrl: string; downloadUrl: string };

const zoomSteps = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default function Reader({ slug, title, titleLocale, pdfUrl, downloadUrl }: ReaderProps) {
  const t = useTranslations("Books.reader");
  const books = useTranslations("Books");
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [zoom, setZoom] = useState(2);
  const [width, setWidth] = useState(0);
  const [findOpen, setFindOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<{ term: string; pages: number[] | null } | null>(null);
  const holder = useRef<HTMLDivElement>(null);
  const toolbar = useRef<HTMLDivElement>(null);
  const pageTexts = useRef<Map<number, string>>(new Map());
  const storageKey = `book-page:${slug}`;
  const numPages = pdf?.numPages ?? 0;

  // Fit the page to the screen width, then zoom from there
  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.min(entry.contentRect.width, 900)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const goTo = useCallback(
    (n: number) => {
      if (!numPages) return;
      const next = Math.min(Math.max(1, n), numPages);
      setPage(next);
      setPageInput(String(next));
      try {
        localStorage.setItem(storageKey, String(next));
      } catch {}
      // Bring the top of the new page into view, just below the toolbar
      const top = (holder.current?.getBoundingClientRect().top ?? 0) - (toolbar.current?.offsetHeight ?? 0);
      if (top < 0) window.scrollBy({ top, behavior: "smooth" });
    },
    [numPages, storageKey],
  );

  function onLoad(doc: PDFDocumentProxy) {
    setPdf(doc);
    pageTexts.current.clear();
    // Pick up where this visitor left off
    let saved = 1;
    try {
      saved = Number(localStorage.getItem(storageKey)) || 1;
    } catch {}
    const start = Math.min(Math.max(1, saved), doc.numPages);
    setPage(start);
    setPageInput(String(start));
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight") goTo(page + 1);
      if (e.key === "ArrowLeft") goTo(page - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, page]);

  async function find(e: FormEvent) {
    e.preventDefault();
    const term = query.trim();
    if (!pdf || !term) return;
    setSearch({ term, pages: null });
    const needle = term.toLocaleLowerCase();
    const found: number[] = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      let text = pageTexts.current.get(n);
      if (text === undefined) {
        const content = await (await pdf.getPage(n)).getTextContent();
        text = content.items.map((item) => ("str" in item ? item.str : "")).join(" ").toLocaleLowerCase();
        pageTexts.current.set(n, text);
      }
      if (text.includes(needle)) found.push(n);
    }
    setSearch({ term, pages: found });
    if (found.length) goTo(found.find((n) => n >= page) ?? found[0]);
  }

  const term = search?.term;
  const highlight = useCallback(
    ({ str }: { str: string }) => {
      const safe = escapeHtml(str);
      if (!term) return safe;
      return safe.replace(new RegExp(escapeRegExp(escapeHtml(term)), "gi"), (m) => `<mark>${m}</mark>`);
    },
    [term],
  );

  const button =
    "rounded-full border border-gold/40 bg-warm-white px-2.5 py-1 text-sm sm:px-3 sm:py-1.5 hover:border-saffron disabled:opacity-40 disabled:hover:border-gold/40";

  return (
    <div className="pb-16">
      <div ref={toolbar} className="sticky top-0 z-10 border-b border-gold/30 bg-warm-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2">
          <Link href={`/books/${slug}`} aria-label={books("backToBook")} className="text-sm text-saffron hover:underline">
            ← <span className="hidden sm:inline">{books("backToBook")}</span>
          </Link>
          <span lang={titleLocale} className="hidden min-w-0 flex-1 truncate font-serif text-maroon md:block">
            {title}
          </span>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <button type="button" onClick={() => setZoom((z) => Math.max(0, z - 1))} disabled={zoom === 0} aria-label={t("zoomOut")} title={t("zoomOut")} className={button}>
              −
            </button>
            <span className="w-10 text-center text-sm tabular-nums">{Math.round(zoomSteps[zoom] * 100)}%</span>
            <button type="button" onClick={() => setZoom((z) => Math.min(zoomSteps.length - 1, z + 1))} disabled={zoom === zoomSteps.length - 1} aria-label={t("zoomIn")} title={t("zoomIn")} className={button}>
              +
            </button>
            <button type="button" onClick={() => setFindOpen((o) => !o)} aria-expanded={findOpen} className={button}>
              <span aria-hidden>⌕ </span>
              {t("findShort")}
            </button>
            <a href={downloadUrl} className={button} aria-label={books("download")} title={books("download")}>
              <span aria-hidden>⤓ </span>PDF
            </a>
          </div>
        </div>
        {findOpen && (
          <div className="mx-auto max-w-5xl px-4 pb-2">
            <form onSubmit={find} className="flex gap-2">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("findPlaceholder")}
                aria-label={t("find")}
                autoFocus
                className="min-w-0 flex-1 rounded-full border border-gold/40 bg-white px-3 py-1.5 text-sm focus:border-saffron focus:outline-none"
              />
              <button type="submit" disabled={!pdf} className={button}>
                {books("search")}
              </button>
            </form>
            {search && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-sm" aria-live="polite">
                {search.pages === null ? (
                  <span className="text-charcoal/70">{t("searching")}</span>
                ) : search.pages.length === 0 ? (
                  <span className="text-charcoal/70">{t("notFound")}</span>
                ) : (
                  <>
                    <span className="text-charcoal/70">{t("found", { count: search.pages.length })}</span>
                    {search.pages.slice(0, 50).map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => goTo(n)}
                        className={`rounded px-2 py-0.5 tabular-nums ${n === page ? "bg-saffron text-white" : "bg-cream hover:bg-gold/20"}`}
                      >
                        {n}
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div ref={holder} className="mx-auto max-w-[900px] px-2 pt-4 sm:px-4">
        <Document
          file={pdfUrl}
          onLoadSuccess={onLoad}
          loading={<p className="py-16 text-center text-charcoal/70">{t("loading")}</p>}
          error={
            <p className="py-16 text-center">
              {t("error")}{" "}
              <a href={downloadUrl} className="text-saffron underline">
                {books("download")}
              </a>
            </p>
          }
        >
          {width > 0 && pdf && (
            <div className="overflow-x-auto">
              <Page
                pageNumber={page}
                width={width * zoomSteps[zoom]}
                customTextRenderer={highlight}
                className="mx-auto w-fit shadow-md"
                loading={<div style={{ height: width * 1.3 }} />}
              />
            </div>
          )}
        </Document>
      </div>

      {numPages > 0 && (
        <nav className="mx-auto mt-4 flex max-w-[900px] items-center justify-between gap-3 px-4">
          <button type="button" onClick={() => goTo(page - 1)} disabled={page <= 1} aria-label={t("previousPage")} className={button}>
            ← <span className="hidden sm:inline">{t("previousPage")}</span>
          </button>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              goTo(Number(pageInput) || page);
            }}
            className="flex items-center gap-1.5 whitespace-nowrap text-sm"
          >
            <label htmlFor="reader-page">{t("page")}</label>
            <input
              id="reader-page"
              inputMode="numeric"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ""))}
              onBlur={() => goTo(Number(pageInput) || page)}
              className="w-14 rounded border border-gold/40 bg-white px-2 py-1 text-center tabular-nums"
            />
            <span className="tabular-nums">{t("of", { total: numPages })}</span>
          </form>
          <button type="button" onClick={() => goTo(page + 1)} disabled={page >= numPages} aria-label={t("nextPage")} className={button}>
            <span className="hidden sm:inline">{t("nextPage")}</span> →
          </button>
        </nav>
      )}
    </div>
  );
}
