import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    // pdf.js's default build needs browsers from 2025 on; the legacy build also runs on older iPhones
    resolveAlias: {
      "pdfjs-dist": "pdfjs-dist/legacy/build/pdf.mjs",
    },
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
