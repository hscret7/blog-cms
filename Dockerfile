FROM node:24-bookworm AS dependencies

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev


FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules

COPY package.json package-lock.json ./
COPY src/ ./src/
COPY views/ ./views/
COPY public/ ./public/
COPY scripts/ ./scripts/

RUN mkdir -p /app/uploads/covers \
    && chown -R node:node /app/uploads \
    && chmod 700 /app/uploads /app/uploads/covers

USER node

EXPOSE 3000

CMD ["node", "src/server.js"]