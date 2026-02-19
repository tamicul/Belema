# Belema production image (Next.js + Prisma)

FROM node:22-bookworm-slim AS deps
WORKDIR /app

# System deps needed for prisma + bcryptjs (pure JS) + pdfkit
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci


FROM node:22-bookworm-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate prisma client and build Next.js
RUN npx prisma generate
RUN npm run build


FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1001 nodejs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/middleware.ts ./middleware.ts
COPY --from=builder /app/scripts ./scripts

# Next.js bundling can cause pdfkit to look for its built-in AFM font data under /ROOT.
# Provide a compatibility copy so Evidence Pack PDF works in production.
RUN mkdir -p /ROOT/node_modules/pdfkit/js && \
    cp -a /app/node_modules/pdfkit/js/data /ROOT/node_modules/pdfkit/js/data

COPY ./deploy/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

USER nodejs
EXPOSE 3000

# Runs migrations, optional seed, then starts Next
CMD ["/app/entrypoint.sh"]
