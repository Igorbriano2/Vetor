# Serviço de render (Parte 5/6) — precisa do binário ffmpeg de verdade no
# PATH, o que o buildpack node-js padrão da DigitalOcean não garante de
# forma confiável (achado da spike: pacotes de codec ficam em caminhos não
# padrão, inacessíveis em runtime). Dockerfile explícito resolve isso.
FROM node:20-slim AS build

# ffmpeg só é necessário em runtime, mas instalar aqui também não tem custo
# — a imagem final (stage runtime) reinstala do zero, mantendo o build
# reprodutível independente da ordem dos estágios.
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-slim AS runtime
# ffmpeg via apt (build oficial do Debian) — nunca baixa um binário solto
# de fonte não verificada.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund
COPY --from=build /app/dist ./dist

EXPOSE 3333
CMD ["node", "dist/server.js"]
