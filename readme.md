# Projeto Agnus

As pastas do front e back devem ficar exatamente assim:

- agnus-back
- agnus-front

Se precisar regerar certificados, use a sequencia de comandos abaixo

- choco install mkcert
- mkcert agnus
- mkcert -install

coloque os arquivos agnus-key.pem e agnus.pem dentro de uma pasta chamada "certs"

## Docker

Comandos para subir e derrubar containers:

- docker compose down
- docker compose up -d --build
