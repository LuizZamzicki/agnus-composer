# Contexto de build: a pasta services/ (o pacote comum entra junto).
FROM node:22-alpine AS builder

WORKDIR /app

COPY . .

RUN npm ci -w comum -w carrinho --include-workspace-root
RUN npm run build -w comum -w carrinho
RUN rm -rf node_modules && npm ci --omit=dev -w comum -w carrinho

FROM node:22-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/comum/package.json ./comum/package.json
COPY --from=builder /app/comum/dist ./comum/dist
COPY --from=builder /app/carrinho/package.json ./carrinho/package.json
COPY --from=builder /app/carrinho/dist ./carrinho/dist
COPY carrinho/openapi.yaml ./carrinho/openapi.yaml
WORKDIR /app/carrinho

EXPOSE 3000

CMD ["node", "dist/server.js"]
