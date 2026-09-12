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

# --- Stage 2: serve with unprivileged nginx on 8080 ---
FROM nginxinc/nginx-unprivileged:1.27-alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/healthz.txt || exit 1
