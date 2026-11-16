import type { Afiliados } from "../models";
import { config } from "../utils/config";
import { produtosDoCatalogo } from "./catalogo.service";
import { carregarRegras, dinheiro, taxaDoItem } from "./comissao.service";
import LinkService, { linkCurto } from "./link.service";
import { paginacao } from "./relatorio.service";

const ORDENS = ["relevancia", "comissao_desc", "preco_asc", "preco_desc"] as const;

const semAcento = (texto: string) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

class OfertaService {
  // productOfferV2 da Shopee: produtos ativos com a taxa e a comissão estimada para ESTE afiliado,
  // já com o link de afiliado pronto para divulgar.
  static async listar(afiliado: Afiliados, query: Record<string, unknown>) {
    const { page, limit, offset } = paginacao(query, 20, 50);
    const busca = typeof query.busca === "string" ? semAcento(query.busca.trim()) : "";
    const idCategoria = query.id_categoria === undefined ? undefined : Number(query.id_categoria);
    const ordenar = ORDENS.includes(query.ordenar as (typeof ORDENS)[number]) ? (query.ordenar as (typeof ORDENS)[number]) : "relevancia";

    const regras = await carregarRegras();
    const ofertas = (await produtosDoCatalogo())
      .filter((p) => p.ativo)
      .filter((p) => !busca || semAcento(p.nome).includes(busca))
      .filter((p) => idCategoria === undefined || p.id_categoria === idCategoria)
      .map((p) => {
        const { taxa, origem_taxa } = taxaDoItem(p, regras, afiliado);
        return {
          id_produto: p.id_produto,
          nome: p.nome,
          id_categoria: p.id_categoria,
          categoria_nome: p.categoria_nome,
          preco: p.preco_base,
          preco_original: p.preco_original,
          imagem: p.imagens[0] ? `${config.urlDoSite()}/api/${p.imagens[0].replace(/^\/?(api\/)?/, "")}` : null,
          taxa_comissao: taxa,
          origem_taxa,
          comissao_estimada: dinheiro((p.preco_base * taxa) / 100),
          link_produto: `${config.urlDoSite()}/produto/${p.id_produto}`,
        };
      });

    if (ordenar === "comissao_desc") ofertas.sort((a, b) => b.comissao_estimada - a.comissao_estimada);
    if (ordenar === "preco_asc") ofertas.sort((a, b) => a.preco - b.preco);
    if (ordenar === "preco_desc") ofertas.sort((a, b) => b.preco - a.preco);

    const pagina = ofertas.slice(offset, offset + limit);
    const links = await LinkService.linksPadrao(afiliado, pagina.map((o) => `/produto/${o.id_produto}`));

    return {
      data: pagina.map((oferta) => {
        const link = links.get(`/produto/${oferta.id_produto}`);
        return { ...oferta, link_afiliado: link ? linkCurto(link.slug) : null };
      }),
      pagination: { page, limit, total: ofertas.length, totalPages: Math.ceil(ofertas.length / limit), hasNextPage: offset + limit < ofertas.length },
    };
  }
}

export default OfertaService;
