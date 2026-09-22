FROM node:24-alpine AS build

WORKDIR /app

COPY api/package*.json ./
RUN npm ci

COPY api/src ./src
COPY api/tsconfig.json ./tsconfig.json

RUN npm run build

FROM node:24-alpine AS runtime

WORKDIR /app

RUN apk upgrade --no-cache

COPY api/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

RUN rm -rf /usr/local/lib/node_modules/npm \
  /usr/local/lib/node_modules/corepack \
  /usr/local/bin/npm \
  /usr/local/bin/npx \
  /usr/local/bin/corepack

COPY --from=build /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=4000

USER node

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/health > /dev/null || exit 1

CMD ["node", "dist/server.js"]
