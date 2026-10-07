# Astro Shantiram

Website for Acharya Shantiram Koirala: astrology, puja, consultations and spiritual knowledge, in English, नेपाली and संस्कृतम्.

The full product spec lives in [docs/spec.md](docs/spec.md).

## Status

Phase 1, public site only. There is no backend yet.

| Part | State |
| --- | --- |
| `frontend/` | Next.js 16 (App Router, TypeScript, Tailwind 4, next-intl). Home, About, Services and Contact in `/en`, `/ne`, `/sa`. |
| `backend/` | Not started (Express + PostgreSQL per the spec). |

The contact form validates input but only logs messages on the server until the `/api/contact` endpoint exists.

## Run locally

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000. It redirects to `/en`, or to `/ne` / `/sa` based on the browser language.

## Translations

UI text lives in `frontend/messages/{en,ne,sa}.json`. The Nepali and Sanskrit strings were drafted by machine and need review by a native speaker.
