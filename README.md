# portal

The public front door for **Fjällbark Cloud** — a dark-first, minimal homepage
listing Fjällbark's self-hosted public services as service cards. Everything on
the page is driven by a config-first service registry; no service data is
hardcoded in components, and the built site ships zero client-side JavaScript.

## Tech stack

- [Astro 5](https://astro.build) — static output, no client-side JS
- Self-hosted [Inter variable font](https://www.npmjs.com/package/@fontsource-variable/inter)
  (no external font requests)
- nginx (unprivileged image, listens on 8080) serving the static build in production
- TypeScript (strict), Vitest for config-validation tests

## Local development

Prerequisites: Node 22+ and npm.

```bash
npm install       # install dependencies
npm run dev       # dev server at http://localhost:4321
npm run build     # production build into dist/
npm run preview   # preview the production build locally
npm run check     # astro check (types + diagnostics)
npm test          # vitest: validates the service registry and site config
```

## Docker

Multi-stage build: Node 22 builds the site, `nginxinc/nginx-unprivileged`
(ports 8080, non-root) serves it. Includes a `HEALTHCHECK` against
`/healthz.txt`.

```bash
docker build -t portal:test .
docker run -d --name portal-test -p 18080:8080 portal:test
curl -fsS http://127.0.0.1:18080/healthz.txt   # -> ok
docker rm -f portal-test
```

Or with Compose (host port configurable via `PORT`, defaults to 8080):

```bash
docker compose up --build
```

## Adding or editing a service

> **Note:** the live/beta service URLs currently point at `*.example.com`
> **placeholders.** Replace them with the real public URLs in
> `src/config/services.ts` before pointing users at this page.

Services live in one place: `src/config/services.ts`. Add a new entry to the
array — **array order is the display order**, and category sections appear in
order of first appearance in the array (reordering the array reorders the
page).

```ts
{
  id: "my-service",              // unique slug
  name: "My Service",            // unique display name
  description: "What it does.",  // one line, shown on the card
  url: "https://my.example.com", // https:// URL; use "" while planned
  category: "Tools",             // section heading (created on first use)
  status: "live",                // "live" | "beta" | "planned"
  icon: "deck",                  // key from src/lib/icons.ts
}
```

Rules:

- `url: ""` marks a planned service: it renders as a non-link card with a
  "Planned" badge.
- `live`/`beta` services render as link cards and must have a well-formed
  `https://` URL.
- `icon` must be a key defined in `src/lib/icons.ts` (add a new minimal
  24x24 stroke SVG there if needed).
- `npm test` validates the registry (required fields, unique ids/names,
  status enum, URL shape, icon resolution) — run it after editing.

## Project structure

```
├── astro.config.mjs          # Astro config (static output, external stylesheets)
├── nginx/
│   └── default.conf          # site config: gzip, caching, security headers
├── public/
│   ├── favicon.svg           # original mark, bark amber on dark
│   ├── healthz.txt           # container health probe ("ok")
│   └── robots.txt
├── src/
│   ├── components/
│   │   ├── ServiceCard.astro # link or non-link card + status badge
│   │   ├── ServiceIcon.astro # renders an icon from the registry
│   │   ├── SiteFooter.astro
│   │   └── SiteHeader.astro
│   ├── config/
│   │   ├── services.ts       # THE service registry (single source of truth)
│   │   ├── site.ts           # site name, title, description, tagline, footer
│   │   └── validate.ts       # Service types + validateServices() (pure)
│   ├── layouts/
│   │   └── BaseLayout.astro  # <head>, fonts, tokens, skip link
│   ├── lib/
│   │   └── icons.ts          # named inline-SVG icon registry
│   ├── pages/
│   │   └── index.astro       # hero + category sections + cards
│   └── styles/
│       ├── global.css        # reset + base styles
│       └── tokens.css        # design tokens (colors, spacing, fonts, ...)
├── tests/
│   └── services.test.ts      # vitest suite for the config
├── Dockerfile                # multi-stage: node build -> nginx serve
└── docker-compose.yml
```

## Design tokens

`src/styles/tokens.css` defines the design tokens (dark-first palette with the
"bark amber" accent, spacing scale, radii, font stacks, shadow, focus ring,
motion). It is the single source of truth for portal's visual language and the
intended shared foundation for future Fjällbark pages.
