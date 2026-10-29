# Builds the SPA and serves it with Caddy, which also proxies the API (docs/02 §2).
FROM node:24-alpine AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM caddy:2.10-alpine
# Listens on 8080, so no root needed (Trivy AVD-DS-0002).
RUN addgroup -S -g 10001 app && adduser -S -u 10001 -G app app \
 && mkdir -p /data/caddy /config/caddy && chown -R app:app /data /config
COPY deploy/caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
USER app
