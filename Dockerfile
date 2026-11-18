# Imagem de produção da NÓS Studio (site + painel).
# Os dados (banco SQLite e uploads) ficam em /app/data — monte um VOLUME persistente nesse caminho.
FROM node:22-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1

RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
# devDependencies ficam na imagem de propósito: o start roda as migrations (tsx + drizzle).
RUN npm ci --include=dev

COPY . .
# O build roda sem o banco real; as páginas são regeneradas na inicialização (scripts/start.sh).
RUN npm run build

EXPOSE 3000
VOLUME ["/app/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

CMD ["sh", "scripts/start.sh"]
