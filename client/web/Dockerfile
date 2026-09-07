FROM oven/bun:1.4.0-alpine AS bun
FROM node:24-alpine AS build
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
ARG VITE_API_URL=/api
ARG VITE_TURN_URL
ARG VITE_TURN_USERNAME
ARG VITE_TURN_CREDENTIAL
ENV VITE_API_URL=$VITE_API_URL VITE_TURN_URL=$VITE_TURN_URL VITE_TURN_USERNAME=$VITE_TURN_USERNAME VITE_TURN_CREDENTIAL=$VITE_TURN_CREDENTIAL
COPY package.json bun.lock ./
COPY desktop/package.json desktop/package.json
COPY web/package.json web/package.json
COPY shared/package.json shared/package.json
RUN bun install --frozen-lockfile --filter @huddle/web --filter @huddle/shared
COPY web web
COPY shared shared
RUN bun run --cwd web build

FROM nginx:1.29-alpine AS runtime
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/web/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/healthz || exit 1
