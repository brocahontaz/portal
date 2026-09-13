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

### Runtime service config

At container start the entrypoint can re-render the page from a services JSON
file instead of the registry baked into the image (`src/config/services.ts`):
point `PORTAL_SERVICES_PATH` at the file's path *inside the container* and
mount the file there. `docker-compose.yml` passes the variable through from
the host (environment variable or `.env` file next to the compose file):

```bash
# one-off with docker run
docker run -d --name portal -p 8080:8080 \
  -e PORTAL_SERVICES_PATH=/data/services.json \
  -v ./services.json:/data/services.json:ro \
  ghcr.io/brocahontaz/portal:latest
```

or with Compose — a small `docker-compose.override.yml` for the mount (compose
auto-loads it on top of `docker-compose.yml`; keep it out of version
control), plus the host variable:

```yaml
# docker-compose.override.yml
services:
  portal:
    volumes:
      - ./services.json:/data/services.json:ro
```

```bash
PORTAL_SERVICES_PATH=/data/services.json docker compose up -d
```

Behavior — fail-fast, so a bad config can never silently change the page:

- `PORTAL_SERVICES_PATH` unset, empty, or pointing at a file that does not
  exist → the baked-in default registry is served.
- The file exists but is invalid (bad JSON, not an array, missing fields,
  duplicate ids/names, unknown icon, invalid status, `live`/`beta` with a
  non-`https://` URL, `planned` with a non-empty URL, ...) → the container
  exits non-zero at start and never serves.

`config/services.example.json` is a schema example mirroring the registry
array shape (same fields as [Adding or editing a service](#adding-or-editing-a-service)).

## CI/CD

GitHub Actions live in `.github/workflows/`:

- **CI (`ci.yml`)** — runs on every pull request and push to `main`:
  `astro check`, `npm test`, `npm run build`, then a Docker build (with a
  GitHub Actions build cache) and a runtime smoke test: the container must
  answer `/healthz.txt` with `ok`, serve `/` with HTTP 200, and send the
  security headers (e.g. `X-Frame-Options: DENY`).
- **Release (`release.yml`)** — runs on pushes to `main` and on `v*` tags.
  It re-runs the checks (Actions cannot gate one workflow on another), then
  builds a multi-arch (`linux/amd64` + `linux/arm64`) image and publishes it
  to **`ghcr.io/brocahontaz/portal`**:

  | Event | Image tags |
  | --- | --- |
  | Tag push `v1.2.3` | `1.2.3`, `1.2`, `sha-<short>` |
  | Push to `main` | `latest`, `sha-<short>` |

  Deployments only run for pushes to `main` and stay a no-op until the host
  secrets below are configured.

### Deploying on the public host

The host needs Docker with the Compose plugin and a deploy directory
(default `/opt/portal`, configurable) containing this repo's
`docker-compose.yml` — it pins `image: ghcr.io/brocahontaz/portal:latest`, so
deployment is just:

```bash
docker compose pull
docker compose up -d --remove-orphans
docker image prune -f
```

The workflow does this over SSH when these secrets are set (**Settings →
Secrets and variables → Actions**):

| Secret | Required | Description |
| --- | --- | --- |
| `DEPLOY_HOST` | yes | Public hostname of the deploy host |
| `DEPLOY_USER` | yes | SSH user on the deploy host |
| `DEPLOY_SSH_KEY` | yes | Private SSH key authorized for that user |
| `DEPLOY_PORT` | no | SSH port (default `22`) |
| `DEPLOY_DIR` | no | Repository *variable*: deploy directory (default `/opt/portal`) |

### Making the image pullable

The GHCR package inherits the repository's visibility. If this repo is
private, the deploy host must authenticate before `docker compose pull`
(`docker login ghcr.io` with a personal access token that has
`read:packages` scope). To avoid that, make the package public: on GitHub,
open the repository's **Packages** entry for `ghcr.io/brocahontaz/portal`
(or your profile → **Packages**), go to **Package settings** → **Danger
Zone** → **Change visibility** → **Public**.

### Using your own registry image

If you publish the image to your own registry instead of
`ghcr.io/brocahontaz/portal`, point compose at it with a
`docker-compose.override.yml` (compose auto-loads this file on top of
`docker-compose.yml`; keep it out of version control):

```yaml
services:
  portal:
    image: registry.example.com/fjallbark/portal:latest
    build: !reset null   # drop the local build; always pull
```

`build: !reset null` removes the base file's `build:` key, so
`docker compose pull` fetches your image and `docker compose up -d` deploys
it — no local build, no GHCR authentication. (The `!reset`/`!override` YAML
tags require a reasonably recent Compose — v2.26+, 2024 — older versions fail
with a cryptic unknown-YAML-tag error.)

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
├── .github/
│   └── workflows/
│       ├── ci.yml             # PR/main gate: check, test, build, image smoke test
│       └── release.yml        # publish multi-arch image to ghcr.io + SSH deploy
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
