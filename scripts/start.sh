#!/usr/bin/env sh
# Inicialização em produção: atualiza o banco, sobe o servidor e renova o cache do site.
#   - migrations + conteúdo inicial são idempotentes (não alteram dados existentes);
#   - a primeira chamada a /api/health invalida as páginas pré-renderizadas no build, para que o site
#     sempre reflita o banco real (importante quando o build roda sem acesso ao banco, ex.: imagem Docker).
set -e
PORT="${PORT:-3000}"

npm run db:setup

npx next start -p "$PORT" &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null' INT TERM

i=0
until wget -q -O /dev/null "http://127.0.0.1:$PORT/api/health" 2>/dev/null || curl -fsS -o /dev/null "http://127.0.0.1:$PORT/api/health" 2>/dev/null; do
  i=$((i + 1))
  if [ "$i" -ge 60 ]; then echo "O servidor não respondeu em 60s." >&2; kill "$SERVER_PID" 2>/dev/null; exit 1; fi
  sleep 1
done
echo "NÓS Studio no ar na porta $PORT."

wait "$SERVER_PID"
