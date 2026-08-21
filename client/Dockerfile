FROM oven/bun:1.3.12-alpine AS build
WORKDIR /app
ARG VITE_API_URL=/api
ARG VITE_TURN_URL
ARG VITE_TURN_USERNAME
ARG VITE_TURN_CREDENTIAL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_TURN_URL=$VITE_TURN_URL
ENV VITE_TURN_USERNAME=$VITE_TURN_USERNAME
ENV VITE_TURN_CREDENTIAL=$VITE_TURN_CREDENTIAL
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM nginx:1.29-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 5173
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:5173/healthz || exit 1
