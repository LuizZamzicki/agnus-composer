FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./

# Cypress so e usado pra testes e2e (fora dessa imagem); pular o download do
# binario (~250MB) evita minutos de build sem nenhum ganho pro build de producao.
ENV CYPRESS_INSTALL_BINARY=0

RUN npm ci --legacy-peer-deps

COPY . .

RUN npm run build

# Imagem final apenas publica os estaticos no volume compartilhado com o nginx
FROM alpine:3.20

WORKDIR /app

COPY --from=builder /app/build ./build

CMD ["sh", "-c", "rm -rf /output/* && cp -a /app/build/. /output/ && echo 'Frontend build publicado em /output'"]
