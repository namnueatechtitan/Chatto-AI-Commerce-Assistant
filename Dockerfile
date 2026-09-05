FROM node:20-alpine AS dependencies

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN apk add --no-cache openssl \
    && corepack enable \
    && corepack prepare pnpm@9.12.0 --activate

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/ai-service/package.json apps/ai-service/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

FROM dependencies AS source

COPY . .

RUN pnpm prisma:generate

FROM source AS api

RUN pnpm --filter @chatto/shared build \
    && pnpm --filter @chatto/config build \
    && pnpm --filter @chatto/api build

CMD ["node", "apps/api/dist/main.js"]

FROM source AS ai-service

RUN pnpm --filter @chatto/ai-service build

CMD ["node", "apps/ai-service/dist/index.js"]

FROM source AS web

ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

RUN pnpm --filter @chatto/shared build \
    && pnpm --filter @chatto/config build \
    && pnpm --filter @chatto/web build

CMD ["pnpm", "--filter", "@chatto/web", "start"]
