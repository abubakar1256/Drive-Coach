FROM node:22-alpine AS dependencies
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY api/package.json api/package.json
RUN pnpm install --frozen-lockfile

FROM dependencies AS builder
ENV DATABASE_URL=postgresql://routepilot:build@localhost:5432/driving_routes?schema=public
COPY api api
RUN pnpm --dir api exec prisma generate
RUN pnpm --dir api build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/api ./api
EXPOSE 4000
CMD ["sh", "-c", "pnpm --dir api exec prisma migrate deploy && pnpm --dir api start"]
