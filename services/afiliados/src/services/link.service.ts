import { Op } from "sequelize";
import { HttpError } from "@agnus/comum/types/http_error";
import { AfiliadoCliques, AfiliadoLinks, Afiliados } from "../models";
import { config } from "../utils/config";
import { assinarReferencia, gerarCodigo, hashDoIp } from "../utils/seguranca";

const SUB_ID = /^[A-Za-z0-9_-]{1,50}$/;
const MAX_SUB_IDS = 5;

export const linkCurto = (slug: string) => `${config.urlDoSite()}/l/${slug}`;

// Só aceita destinos dentro da loja (evita usar nosso domínio como redirecionador aberto).
// Guarda apenas caminho + query, ex.: "/produto/12?cor=preto".
export const normalizarDestino = (url: unknown) => {
  if (typeof url !== "string" || !url.trim()) {
    throw new HttpError(400, "Informe a URL da loja que o link deve abrir (ex.: /produto/12).");
  }

  const site = new URL(config.urlDoSite());
  let destino: URL;

  try {
    destino = new URL(url.trim(), site);
  } catch {
    throw new HttpError(400, "URL inválida.");
  }

  if (destino.host !== site.host || !/^https?:$/.test(destino.protocol)) {
    throw new HttpError(400, `O link precisa apontar para a loja (${site.host}).`);
  }

  const caminho = `${destino.pathname}${destino.search}`;

  if (caminho.length > 500 || caminho.startsWith("//") || caminho.startsWith("/l/") || caminho.startsWith("/api/")) {
    throw new HttpError(400, "URL de destino não permitida.");
  }

  return caminho;
};

export const normalizarSubIds = (subIds: unknown) => {
  if (subIds === undefined || subIds === null) return [];

  if (!Array.isArray(subIds) || subIds.length > MAX_SUB_IDS || !subIds.every((s) => typeof s === "string" && SUB_ID.test(s))) {
    throw new HttpError(400, `sub_ids: até ${MAX_SUB_IDS} textos de 1 a 50 caracteres (letras, números, _ ou -).`);
  }

  return subIds as string[];
};

const camposSubId = (subIds: string[]) =>
  Object.fromEntries(Array.from({ length: MAX_SUB_IDS }, (_, i) => [`sub_id${i + 1}`, subIds[i] ?? null]));

export const serializarLink = (link: AfiliadoLinks) => ({
  id_link: link.id_link,
  slug: link.slug,
  link_curto: linkCurto(link.slug),
  destino: link.destino,
  sub_ids: [link.sub_id1, link.sub_id2, link.sub_id3, link.sub_id4, link.sub_id5].filter(Boolean),
  data_criacao: link.data_criacao,
});

class LinkService {
  // generateShortLink da Shopee: mesmo destino + sub_ids devolve o mesmo link (não duplica).
  static async criar(afiliado: Afiliados, url: unknown, subIdsBrutos: unknown) {
    const destino = normalizarDestino(url);
    const subIds = normalizarSubIds(subIdsBrutos);
    const campos = camposSubId(subIds);

    const existente = await AfiliadoLinks.findOne({ where: { id_afiliado: afiliado.id_afiliado, destino, ...campos } });
    if (existente) return existente;

    for (let tentativa = 0; tentativa < 5; tentativa += 1) {
      const slug = gerarCodigo(8);
      if (await AfiliadoLinks.findOne({ where: { slug } })) continue;
      return AfiliadoLinks.create({ id_afiliado: afiliado.id_afiliado, slug, destino, ...campos });
    }

    throw new HttpError(503, "Não foi possível gerar o link agora. Tente de novo.");
  }

  // Links sem sub_id para vários destinos de uma vez (usado na listagem de ofertas).
  static async linksPadrao(afiliado: Afiliados, destinos: string[]) {
    const existentes = await AfiliadoLinks.findAll({
      where: { id_afiliado: afiliado.id_afiliado, destino: { [Op.in]: destinos }, sub_id1: null, sub_id2: null, sub_id3: null, sub_id4: null, sub_id5: null },
    });
    const porDestino = new Map(existentes.map((link) => [link.destino, link]));

    for (const destino of destinos) {
      if (!porDestino.has(destino)) {
        porDestino.set(destino, await LinkService.criar(afiliado, destino, []));
      }
    }

    return porDestino;
  }

  // GET /l/:slug -> registra o clique, grava o cookie de atribuição e manda para a loja.
  static async registrarClique(slug: string, dados: { ip?: string; userAgent?: string; referer?: string }) {
    if (!/^[a-z0-9]{4,16}$/.test(slug)) return null;

    const link = await AfiliadoLinks.findOne({ where: { slug } });
    if (!link) return null;

    const afiliado = await Afiliados.findByPk(link.id_afiliado);

    // Afiliado suspenso: o link continua levando à loja, mas não gera clique nem comissão.
    if (!afiliado || afiliado.status !== "ativo") {
      return { destino: link.destino, cookie: null };
    }

    const clique = await AfiliadoCliques.create({
      id_link: link.id_link,
      id_afiliado: link.id_afiliado,
      ip_hash: hashDoIp(dados.ip),
      user_agent: dados.userAgent?.slice(0, 255) ?? null,
      referer: dados.referer?.slice(0, 255) ?? null,
    });

    const maxAge = config.janelaDias() * 24 * 60 * 60;
    const expira = Math.floor(Date.now() / 1000) + maxAge;

    return { destino: link.destino, cookie: { valor: assinarReferencia(Number(clique.id_clique), expira), maxAge } };
  }
}

export default LinkService;
