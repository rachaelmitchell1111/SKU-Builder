# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

ENV NODE_ENV=production

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app .

EXPOSE 3000

CMD ["node", "server.js"]
