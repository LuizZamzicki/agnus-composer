# Runbook de Incidentes — Agnus

> Objetivo: qualquer pessoa da equipe consegue **restabelecer o serviço** seguindo este documento, mesmo sem conhecer o código a fundo. Primeiro restabelecer, depois investigar.

## 0. Primeiros 5 minutos (sempre)

1. **Confirmar o problema**:

   ```bash
   curl -sk https://localhost/api/health          # esperado: {"status":"ok"}
   docker compose ps                               # algum container "unhealthy" ou "Restarting"?
   ```

2. **Classificar a severidade**:

   | Severidade | Exemplo | Tempo de resposta |
   | --- | --- | --- |
   | **P1** | Site fora, checkout falhando, vazamento de dados | Imediato |
   | **P2** | Lentidão, busca/cache degradados, login Google fora | Até 1 h |
   | **P3** | Notificações/auditoria paradas, erro em tela administrativa | Próximo dia útil |

3. **Comunicar** no canal da equipe: *"Incidente P1 em andamento: <sintoma>. Responsável: <nome>."*
4. **Houve deploy recente?** Se sim e o problema começou logo depois, faça **rollback primeiro** (§6) e investigue depois.

## 1. Site fora do ar

| Sintoma | Verificação | Ação |
| --- | --- | --- |
| Navegador não abre `https://...` | `docker compose ps nginx` | `docker compose up -d nginx`; se não subir, `docker compose logs nginx` (certificado em `certs/`? `nginx.conf` válido?) |
| Página abre, mas a API retorna **502** | `docker compose ps backend` | `docker compose logs --tail=100 backend`, depois `docker compose restart backend` |
| Backend reinicia em loop | logs com `ECONNREFUSED mysql` ou erro de `.env` | Verificar o MySQL (§1.1) e as variáveis em `agnus-back/.env` |
| Login responde **429** | `docker compose logs nginx \| grep limiting` | Limite de 10 tentativas/min por IP no Nginx (proteção contra força bruta). Aguarde 1 min; se for legítimo (ex.: teste de carga), ajuste `rate` em `limit_req_zone` no `nginx.conf` |
| `http://<ip>:3000` não responde de outra máquina | `docker compose port backend 3000` → `127.0.0.1:3000` | Comportamento esperado: de fora, a API só passa pelo Nginx em `https://<host>/api` |

### 1.1 MySQL

```bash
docker compose ps mysql
docker compose logs --tail=50 mysql
docker exec agnus-mysql sh -c 'mysqladmin ping -uroot -p"$MYSQL_ROOT_PASSWORD"'
```

- `Access denied`: a senha do `.env` mudou depois de o volume ter sido criado (o MySQL só lê `MYSQL_ROOT_PASSWORD` na primeira inicialização).
- Disco cheio: `docker system df`; libere espaço com `docker image prune`. **Nunca** remova o volume `mysql_data`.

## 2. Muitos erros 500

```bash
docker compose logs --since 15m backend | grep '"level":"error"'
docker compose logs backend | grep <X-Request-Id informado pelo cliente>
curl -sk -H "Authorization: Bearer $TOKEN_ADMIN" https://localhost/api/metrics   # http_requests_5xx subindo? (token de admin)
```

- Procure `http.erro_nao_tratado`: o campo `error.stack` aponta arquivo e linha.
- Se os erros vierem de uma rota específica após um deploy, faça **rollback** (§6).

## 3. Lentidão

1. `curl -sk -H "Authorization: Bearer $TOKEN_ADMIN" https://localhost/api/metrics`: veja `latencyMs.p95` e `sli.cacheHitRatio`.
2. **Taxa de acerto do cache baixa** (< 0,3): o Redis está no ar? (§4)
3. **Cache ok, mas lento**: gargalo no MySQL ou na máquina.

   ```bash
   docker stats --no-stream
   docker exec agnus-mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "SHOW FULL PROCESSLIST"'
   ```

4. Busca lenta: verifique o Meilisearch (`docker compose logs meilisearch`). A API cai para SQL automaticamente se ele estiver fora.

## 4. Redis fora do ar

**Impacto esperado:** nenhum erro para o usuário, só mais lentidão (o cache é ignorado e a API vai direto ao MySQL). Eventos e notificações param.

```bash
docker compose ps redis
docker compose logs backend | grep -E 'redis.erro|cache.circuito_aberto'
docker compose restart redis
docker exec agnus-redis redis-cli ping        # PONG
```

A API e o worker **reconectam sozinhos** (backoff de até 5 s). Não é preciso reiniciá-los. O cache volta vazio e se reaquece com o uso.

Para limpar o cache manualmente (ex.: dado inconsistente):

```bash
docker exec agnus-redis redis-cli --scan --pattern 'agnus:cache:*' | xargs -r docker exec -i agnus-redis redis-cli DEL
```

## 5. Worker não processa eventos

```bash
docker compose ps worker
docker compose logs --tail=50 worker            # deve haver "evento.assinatura_ativa"
docker compose restart worker
docker exec agnus-redis redis-cli LRANGE agnus:auditoria:eventos 0 4   # últimos eventos auditados
```

Eventos publicados enquanto o worker estava fora **não são reprocessados** (Pub/Sub é at-most-once, ver [ADR 0004](../arquitetura/adr/0004-eventos-redis-pubsub.md)). Se forem notificações de pedidos importantes, consulte os pedidos do período no painel administrativo e avise os clientes manualmente.

## 6. Rollback de versão

```bash
cat /opt/agnus/.current_version                   # versão atual
AGNUS_VERSION=v3.2.1 docker compose up -d --no-build
curl -sk https://localhost/api/health
```

Em desenvolvimento (build local): `git checkout <tag-anterior> && docker compose up -d --build`.

## 7. Restaurar backup do banco

```bash
docker exec -i agnus-mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" agnus' < backup_v3.2.1.sql
docker exec agnus-redis redis-cli FLUSHDB        # descarta cache com dados antigos
```

## 8. Depois do incidente (post-mortem sem culpados)

Registrar em até 2 dias úteis, como issue do tipo **Bug** no Jira com o rótulo `incidente`:

1. Linha do tempo (detecção → mitigação → resolução)
2. Impacto (quem, quanto tempo, quantos pedidos)
3. Causa raiz (5 porquês)
4. O que funcionou e o que não funcionou
5. Ações preventivas, com responsável e prazo, que viram itens do backlog

## Contatos e acessos

| Item | Onde |
| --- | --- |
| Repositório | <https://github.com/LuizZamzicki/agnus-composer> |
| Variáveis de ambiente | `.env` (raiz) e `agnus-back/.env`; modelos em `.env.example` |
| Documentação da API | `https://<host>/api/docs/` |
| Métricas | `https://<host>/api/metrics` (exige token de administrador) |
