# ── Dependencies stage ────────────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

COPY package*.json ./
RUN npm ci

# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_API_URL must be supplied at build time (baked into the JS bundle)
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

ENV NODE_ENV=production

WORKDIR /app

COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

EXPOSE 3001

ENV PORT=3001
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
