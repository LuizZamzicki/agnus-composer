# Contexto de build: a pasta services/ (o pacote comum entra junto).
FROM node:22-alpine AS builder

WORKDIR /app

COPY . .

RUN npm ci -w comum -w pedidos --include-workspace-root
RUN npm run build -w comum -w pedidos
RUN rm -rf node_modules && npm ci --omit=dev -w comum -w pedidos

FROM node:22-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/comum/package.json ./comum/package.json
COPY --from=builder /app/comum/dist ./comum/dist
COPY --from=builder /app/pedidos/package.json ./pedidos/package.json
COPY --from=builder /app/pedidos/dist ./pedidos/dist
COPY pedidos/openapi.yaml ./pedidos/openapi.yaml
WORKDIR /app/pedidos

EXPOSE 3000

CMD ["node", "dist/server.js"]
