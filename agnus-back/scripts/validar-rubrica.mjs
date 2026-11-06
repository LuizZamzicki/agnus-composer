// Validacao ponta a ponta dos itens de back-end da rubrica contra a stack do docker compose.
// Uso: docker compose up -d --build && npm run validar:rubrica (na pasta agnus-back).
// Cria um cliente e um admin de teste (validacao.*@agnus.test), roda os fluxos e os remove no fim.
// Observacao: o teste de rate limit bloqueia novos logins deste IP por cerca de 1 minuto.
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const composeFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../docker-compose.yml");
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const API = "https://localhost/api";
const sh = (cmd) => execSync(cmd, { encoding: "utf8" }).trim();
const sql = (q) => execSync(`docker exec -i agnus-mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N "$MYSQL_DATABASE" 2>/dev/null'`, { input: q, encoding: "utf8" }).trim();
const redis = (args) => sh(`docker exec agnus-redis redis-cli ${args}`);

const cpf = (seed) => {
  const d = String(seed).padStart(9, "0").slice(0, 9).split("").map(Number);
  for (const n of [9, 10]) {
    const s = d.reduce((t, v, i) => t + v * (n + 1 - i), 0);
    d.push(((s * 10) % 11) % 10);
  }
  return d.join("");
};

const call = async (method, path, { token, body } = {}) => {
  const res = await fetch(API + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json, requestId: res.headers.get("x-request-id") };
};

const results = [];
const check = (item, desc, ok, detail = "") => {
  results.push({ item, desc, ok, detail });
  console.log(`${ok ? "OK  " : "FALHOU"} [${item}] ${desc}${detail ? ` -> ${detail}` : ""}`);
};

const stamp = Date.now() % 1e8;
const senha = "Validacao#2026xY";
const mk = async (tag, seed) => {
  const email = `validacao.${tag}.${stamp}@agnus.test`;
  const r = await call("POST", "/users", { body: { nome: `Validacao ${tag}`, cpf: cpf(seed), email, senha } });
  if (r.status !== 201) throw new Error(`cadastro ${tag}: ${r.status} ${JSON.stringify(r.json)}`);
  return email;
};
const login = async (email) => (await call("POST", "/auth/login", { body: { email, senha } })).json.token;

const emailCliente = await mk("cliente", 100000000 + (stamp % 89999999));
const emailAdmin = await mk("admin", 200000000 + (stamp % 89999999));
sql(`update usuarios set tipo='administrador' where email='${emailAdmin}'`);
const cliente = await login(emailCliente);
const admin = await login(emailAdmin);
const idCliente = (await call("GET", "/auth/me", { token: cliente })).json.id_usuario ?? (await call("GET", "/auth/me", { token: cliente })).json.user?.id_usuario;

try {
  // ---------- Back-end: cache ----------
  sh(`docker exec agnus-redis sh -c "redis-cli --scan --pattern 'agnus:cache:*' | xargs -r redis-cli DEL" >/dev/null`);
  const q = "/products/catalog?page=1&limit=7";
  const r1 = await call("GET", q);
  const r2 = await call("GET", q);
  const logs = () => sh(`docker compose -f "${composeFile}" logs --since 2m backend worker 2>/dev/null`);
  let l = logs();
  check("Cache Redis", "1ª leitura = cache.miss", l.includes(r1.requestId) && l.split("\n").some((x) => x.includes(r1.requestId) && x.includes("cache.miss")), `requestId ${r1.requestId?.slice(0, 8)}`);
  check("Cache Redis", "2ª leitura = cache.hit", l.split("\n").some((x) => x.includes(r2.requestId) && x.includes("cache.hit")), `requestId ${r2.requestId?.slice(0, 8)}`);
  const ttl = Number(redis(`TTL 'agnus:cache:produtos:catalogo:limit=7&page=1'`));
  check("Cache Redis", "chave com TTL", ttl > 0 && ttl <= 120, `TTL ${ttl}s (config 120s)`);

  const cor = sql("select id_produto_cor, id_produto, coalesce(acrescimo,0) from produto_cores limit 1").split("\t");
  const rUp = await call("PUT", `/product-colors/${cor[0]}`, { token: admin, body: { acrescimo: Number(cor[2]) } });
  const keysDepois = redis(`--scan --pattern 'agnus:cache:produtos:*'`);
  l = logs();
  check("Cache Redis", "update de cor invalida o cache de produtos", rUp.status === 200 && keysDepois === "" && l.includes(`produto_cor.atualizada:${cor[1]}`), `PUT ${rUp.status}; chaves restantes: ${keysDepois === "" ? 0 : keysDepois.split("\n").length}`);

  // ---------- Segurança dos pedidos ----------
  const pManual = await call("POST", "/orders", { token: cliente, body: { id_usuario: idCliente, id_usuario_endereco: 1, status: "pago", valor_total: 0 } });
  check("Boas práticas / DDD", "cliente NÃO cria pedido com valor/status próprios", pManual.status === 403, `POST /orders -> ${pManual.status}`);
  const pItem = await call("POST", "/order-items", { token: cliente, body: { id_pedido: 1, id_produto_cor: 1, id_produto_grade: 1, quantidade: 5 } });
  check("Boas práticas / DDD", "cliente NÃO inclui itens depois do checkout", pItem.status === 403, `POST /order-items -> ${pItem.status}`);

  // ---------- Checkout + eventos ----------
  const end = await call("POST", "/user-addresses", { token: cliente, body: { id_usuario: idCliente, cep: "85810000", logradouro: "Rua Validacao", numero: "1", bairro: "Centro", cidade: "Cascavel", estado: "PR" } });
  const idEnd = end.json.id_usuario_endereco;
  const car = await call("POST", "/carts", { token: cliente, body: { id_usuario: idCliente } });
  const [idCor, idGrade] = sql("select c.id_produto_cor, g.id_produto_grade from produto_cores c join produto_grades g on g.id_produto=c.id_produto join produtos p on p.id_produto=c.id_produto where p.ativo=1 limit 1").split("\t");
  await call("POST", "/cart-items", { token: cliente, body: { id_carrinho: car.json.id_carrinho, id_produto_cor: Number(idCor), id_produto_grade: Number(idGrade), quantidade: 2 } });
  const co = await call("POST", "/orders/checkout", { token: cliente, body: { id_usuario_endereco: idEnd } });
  const idPedido = co.json.id_pedido;
  const itensTotal = sql(`select round(sum(subtotal),2) from pedido_itens where id_pedido=${idPedido}`);
  check("DDD (agregado Pedido)", "checkout calcula o total no servidor", co.status === 201 && Number(co.json.valor_total) === Number(itensTotal), `pedido ${idPedido}: total ${co.json.valor_total} = soma dos itens ${itensTotal}`);

  await new Promise((r) => setTimeout(r, 800));
  l = logs();
  const pub = l.split("\n").find((x) => x.includes("evento.publicado") && x.includes("pedido.criado") && x.includes(co.requestId));
  const rec = l.split("\n").find((x) => x.includes("evento.recebido") && x.includes(co.requestId));
  check("Mensageria Pub/Sub", "API publica pedido.criado", Boolean(pub), pub ? `receivers=${pub.match(/"receivers":(\d+)/)?.[1]}` : "");
  check("Mensageria Pub/Sub", "worker recebe com o mesmo requestId", Boolean(rec), `origemRequestId ${co.requestId?.slice(0, 8)}`);
  const audit = redis("LRANGE agnus:auditoria:eventos 0 0");
  check("Mensageria Pub/Sub", "worker grava a trilha de auditoria", audit.includes(`"id_pedido":${idPedido}`), "LRANGE agnus:auditoria:eventos 0 0");

  // ---------- Máquina de estados ----------
  const t1 = await call("PUT", `/orders/${idPedido}`, { token: admin, body: { status: "pago" } });
  const t2 = await call("PUT", `/orders/${idPedido}`, { token: admin, body: { status: "enviado" } });
  const t3 = await call("PUT", `/orders/${idPedido}`, { token: admin, body: { status: "aguardando_pagamento" } });
  check("DDD (agregado Pedido)", "transições válidas aceitas", t1.status === 200 && t2.status === 200, `aguardando_pagamento->pago ${t1.status}, pago->enviado ${t2.status}`);
  check("DDD (agregado Pedido)", "transição inválida recusada", t3.status === 409, `${t3.status} ${t3.json.message}`);
  const it = await call("POST", "/order-items", { token: admin, body: { id_pedido: idPedido, id_produto_cor: Number(idCor), id_produto_grade: Number(idGrade), quantidade: 1 } });
  check("DDD (agregado Pedido)", "itens não mudam depois do envio", it.status === 409, `${it.status} ${it.json.message}`);
  await new Promise((r) => setTimeout(r, 800));
  l = logs();
  check("Mensageria Pub/Sub", "worker notifica o cliente na mudança de status", l.includes("notificacao.cliente") && l.includes(`"statusNovo":"enviado"`), "notificacao.cliente statusNovo=enviado");

  // ---------- Nginx ----------
  const codes = [];
  for (let i = 0; i < 14; i++) codes.push((await call("POST", "/auth/login", { body: { email: "ninguem@agnus.test", senha: "x" } })).status);
  check("Docker Compose + Nginx", "rate limit no login", codes.includes(429), `respostas: ${[...new Set(codes)].map((c) => `${c}×${codes.filter((x) => x === c).length}`).join(", ")}`);

  // ---------- Observabilidade ----------
  const m = await call("GET", "/metrics", { token: admin });
  const mc = await call("GET", "/metrics", { token: cliente });
  check("Observabilidade", "/metrics para admin, 403 para cliente", m.status === 200 && mc.status === 403, `p95=${m.json.latencyMs?.p95}ms, cacheHitRatio=${m.json.sli?.cacheHitRatio}, events_published=${m.json.counters?.events_published_total}`);
} finally {
  // limpeza dos dados de teste
  const ids = sql(`select group_concat(id_usuario) from usuarios where email like 'validacao.%@agnus.test'`);
  sql(`delete pi from pedido_itens pi join pedidos p on p.id_pedido=pi.id_pedido where p.id_usuario in (${ids}); delete from pedidos where id_usuario in (${ids}); delete ci from carrinho_itens ci join carrinhos c on c.id_carrinho=ci.id_carrinho where c.id_usuario in (${ids}); delete from carrinhos where id_usuario in (${ids}); delete from usuario_enderecos where id_usuario in (${ids}); delete from usuario_senhas_historico where id_usuario in (${ids}); delete from usuarios where id_usuario in (${ids});`);
  console.log(`\nLimpeza: usuários de teste ${ids} removidos.`);
  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} verificações OK`);
  process.exitCode = results.every((r) => r.ok) ? 0 : 1;
}
