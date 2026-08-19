FROM oven/bun:1.3.12-alpine AS dependencies
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1.3.12-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json ./
COPY prisma ./prisma
COPY src ./src
RUN bunx prisma generate
RUN mkdir -p /app/data && chown -R bun:bun /app
USER bun
EXPOSE 3000
VOLUME ["/app/data"]
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD bun -e "const r=await fetch('http://127.0.0.1:3000/health');if(!r.ok)process.exit(1)"
CMD ["sh", "-c", "bunx prisma migrate deploy && exec bun run start"]
