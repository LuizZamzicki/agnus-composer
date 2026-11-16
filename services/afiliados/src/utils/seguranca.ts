import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "crypto";
import { config } from "./config";

// Cada uso tem a sua chave, derivada do AFILIADOS_SEGREDO: vazar uma não compromete as outras.
const chave = (uso: string) => createHmac("sha256", config.segredo()).update(`agnus-afiliados:${uso}`).digest();

const iguais = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

const ALFABETO = "abcdefghjkmnpqrstuvwxyz23456789";

// Códigos curtos e legíveis (sem 0/o, 1/l/i) para slugs de link e código do afiliado.
export const gerarCodigo = (tamanho = 8) =>
  Array.from({ length: tamanho }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");

// ---- Cookie do clique: "<id_clique>.<expira_em_s>.<hmac>" ----
// O navegador guarda só isso; a atribuição confere a assinatura, então ninguém forja um clique.
export const assinarReferencia = (idClique: number, expiraEmSegundos: number) => {
  const corpo = `${idClique}.${expiraEmSegundos}`;
  const assinatura = createHmac("sha256", chave("cookie")).update(corpo).digest("base64url");
  return `${corpo}.${assinatura}`;
};

export const lerReferencia = (valor: unknown, agora = Date.now()) => {
  if (typeof valor !== "string" || valor.length > 200) {
    return null;
  }

  const [id, expira, assinatura] = valor.split(".");

  if (!/^\d{1,18}$/.test(id ?? "") || !/^\d{1,12}$/.test(expira ?? "") || !assinatura) {
    return null;
  }

  const esperada = createHmac("sha256", chave("cookie")).update(`${id}.${expira}`).digest("base64url");

  if (!iguais(assinatura, esperada) || Number(expira) * 1000 < agora) {
    return null;
  }

  return { idClique: Number(id), expiraEm: new Date(Number(expira) * 1000) };
};

// IP nunca é guardado em claro (LGPD): só o hash com chave, que basta para achar cliques repetidos.
export const hashDoIp = (ip: string | undefined) =>
  ip ? createHmac("sha256", chave("ip")).update(ip).digest("hex") : null;

// ---- Segredo da API do afiliado (cifrado no banco: precisamos dele para conferir a assinatura) ----
export const cifrar = (texto: string) => {
  const iv = randomBytes(12);
  const cifra = createCipheriv("aes-256-gcm", chave("segredo-api"), iv);
  const dados = Buffer.concat([cifra.update(texto, "utf8"), cifra.final()]);
  return ["v1", iv.toString("base64url"), cifra.getAuthTag().toString("base64url"), dados.toString("base64url")].join(":");
};

export const decifrar = (valor: string) => {
  const [versao, iv, tag, dados] = valor.split(":");

  if (versao !== "v1" || !iv || !tag || !dados) {
    throw new Error("Segredo cifrado em formato desconhecido.");
  }

  const decifra = createDecipheriv("aes-256-gcm", chave("segredo-api"), Buffer.from(iv, "base64url"));
  decifra.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decifra.update(Buffer.from(dados, "base64url")), decifra.final()]).toString("utf8");
};

export const novoAppId = () => String(randomInt(10, 99)) + Date.now().toString().slice(-6) + String(randomInt(100, 999));
export const novoSegredo = () => randomBytes(24).toString("base64url");

// ---- Assinatura da API aberta, no mesmo formato da Shopee Affiliate Open API ----
// Authorization: SHA256 Credential=<AppId>, Timestamp=<unix s>, Signature=<hex>
// Signature = SHA256(AppId + Timestamp + Payload + Segredo); Payload = corpo JSON enviado (POST)
// ou a query string sem "?" (GET).
export const calcularAssinatura = (appId: string, timestamp: string, payload: string, segredo: string) =>
  createHash("sha256").update(`${appId}${timestamp}${payload}${segredo}`).digest("hex");

export const lerCabecalhoAssinatura = (cabecalho: string | undefined) => {
  if (!cabecalho?.startsWith("SHA256 ")) {
    return null;
  }

  const partes = Object.fromEntries(
    cabecalho
      .slice(7)
      .split(",")
      .map((parte) => parte.trim().split("="))
      .filter((par) => par.length === 2)
      .map(([k, v]) => [k.trim(), v.trim()]),
  );

  return partes.Credential && partes.Timestamp && partes.Signature
    ? { appId: partes.Credential, timestamp: partes.Timestamp, assinatura: partes.Signature.toLowerCase() }
    : null;
};

export const assinaturaConfere = (recebida: string, esperada: string) => iguais(recebida, esperada);
