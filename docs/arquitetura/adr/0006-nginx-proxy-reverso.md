# ADR 0006 — Nginx como proxy reverso único com TLS

- **Status:** Aceito
- **Data:** 2026-06-25

## Contexto

O frontend é um SPA estático e o backend é uma API. Expor os dois em portas/origens diferentes exigiria CORS amplo, dois certificados e duas superfícies de ataque.

## Decisão

Um único **Nginx** (porta 80 → redirect 301; porta 443 com TLS 1.2/1.3) que:

- serve o build do React (volume `frontend_build` populado pelo container `frontend`), com `try_files` para rotas do SPA;
- encaminha `/api/*` para `backend:3000` (removendo o prefixo), repassando `X-Forwarded-*` e `X-Request-Id`;
- aplica cabeçalhos de segurança: HSTS, CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`;
- limita uploads a 20MB (`client_max_body_size`).

O MySQL, o Redis e o Meilisearch ficam na rede `data` (`internal: true`); só o Nginx e o backend participam da rede `app`.

## Consequências

- ✅ Mesma origem para SPA e API: sem problemas de CORS nem cookies de terceiros.
- ✅ Ponto único para TLS, cabeçalhos e, no futuro, rate limiting e cache HTTP de estáticos.
- ⚠️ Certificados locais via `mkcert`/`openssl` (ver readme). Em produção, usar Let's Encrypt.
