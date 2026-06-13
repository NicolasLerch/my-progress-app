FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json backend/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

COPY backend backend
COPY packages/shared packages/shared

RUN pnpm --filter @my-progress/shared build
RUN cd backend && pnpm exec prisma generate
RUN cd backend && pnpm exec tsc -p tsconfig.json

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json backend/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY backend/prisma backend/prisma
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/backend/node_modules backend/node_modules
COPY --from=builder /app/backend/dist backend/dist
COPY --from=builder /app/packages/shared/dist packages/shared/dist

EXPOSE 8080

CMD ["node", "backend/dist/server.js"]
