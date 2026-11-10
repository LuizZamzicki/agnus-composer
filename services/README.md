# Microsserviços do Agnus

Cada pasta é um serviço com `package.json`, `Dockerfile`, testes e contrato OpenAPI próprios. `comum` é a biblioteca de infraestrutura compartilhada. Mapa completo em [docs/arquitetura/microsservicos.md](../docs/arquitetura/microsservicos.md).

```bash
npm ci
npm run build     # compila o pacote comum e os serviços
npm test
npm run lint
npm run validar:rubrica   # ponta a ponta, com a stack do docker compose no ar
```

Os testes importam o `comum` a partir do código-fonte, mas a checagem de tipos usa a versão compilada: rode `npm run build -w comum` depois de alterar esse pacote.
