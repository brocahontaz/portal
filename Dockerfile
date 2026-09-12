# --- Stage 1: build the static site ---
FROM node:22-alpine AS build
WORKDIR /app

# Install dependencies first: only manifests are copied so this layer
# stays cached between builds.
COPY package.json package-lock.json ./
RUN npm ci

# Copy the source and produce the static build in dist/.
COPY . .
RUN npm run build

# --- Stage 2: serve with unprivileged nginx on 8080, carrying node so the
# --- runtime can re-render the site from a mounted services config ---
FROM nginxinc/nginx-unprivileged:1.27-alpine

# node/npm for the runtime re-render. Verified: this base is alpine 3.21,
# where `apk add nodejs` installs node v22.x (measured v22.23.2 — meets the
# Node 22+ requirement of astro 5) and npm ships as a separate apk package.
USER root
RUN apk add --no-cache nodejs npm \
    # The override build replaces the served files as uid 101 at runtime;
    # the base ships /usr/share/nginx/html root-owned, so hand it over here.
    && chown 101:0 /usr/share/nginx/html
USER 101

# The baked default site (served unless an override build succeeds)...
COPY --from=build --chown=101:0 /app/dist /usr/share/nginx/html
# ...plus everything the runtime rebuild needs, all owned by uid 101 so the
# override build can write dist/ and .astro/ inside /opt/portal.
COPY --from=build --chown=101:0 /app/dist /opt/portal/dist
COPY --from=build --chown=101:0 /app/node_modules /opt/portal/node_modules
COPY --from=build --chown=101:0 /app/src /opt/portal/src
COPY --from=build --chown=101:0 /app/public /opt/portal/public
COPY --from=build --chown=101:0 /app/astro.config.mjs /app/tsconfig.json /app/package.json /opt/portal/

COPY --chmod=0755 entrypoint.sh /entrypoint.sh
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# Skip astro's telemetry phone-home on the runtime re-render path.
ENV ASTRO_TELEMETRY_DISABLED=1

ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]

EXPOSE 8080

# --start-period covers the slowest path: a cold override build on a slow
# host must not run the container into unhealthy before nginx starts.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/healthz.txt || exit 1
