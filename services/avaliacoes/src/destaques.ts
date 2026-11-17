import { Op } from "sequelize";
import { consultarOuNull } from "@agnus/comum/utils/clienteInterno";
import logger from "@agnus/comum/utils/logger";
import AvaliacaoFotos from "./models/AvaliacaoFotos";
import AvaliacaoProdutos from "./models/AvaliacaoProdutos";

// Depoimentos da página inicial: avaliações nota 4 ou 5 com comentário (só quem recebeu o produto
// consegue avaliar). Mostra só o primeiro nome de quem escreveu. Guardado 5 minutos em memória.
const LIMITE = 8;
const VALIDADE_MS = 5 * 60 * 1000;
let cache: { ate: number; dados: unknown[] } | null = null;

const primeiroNome = (nome: string | null | undefined) => {
  const primeiro = (nome ?? "").trim().split(/\s+/)[0] ?? "";
  return primeiro ? primeiro.charAt(0).toUpperCase() + primeiro.slice(1).toLowerCase() : "Cliente";
};

export async function avaliacoesEmDestaque() {
  if (cache && cache.ate > Date.now()) return cache.dados;

  const avaliacoes = await AvaliacaoProdutos.findAll({
    where: { nota: { [Op.gte]: 4 }, comentario: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: "" }] } },
    order: [["id_avaliacao_produto", "DESC"]],
    limit: LIMITE * 2,
  });

  const nomes = new Map<number, string>();
  const produtos = new Map<number, { nome: string; ativo: boolean } | null>();

  const dados = [];
  for (const a of avaliacoes) {
    if (!produtos.has(a.id_produto)) {
      produtos.set(a.id_produto, await consultarOuNull<{ nome: string; ativo: boolean }>("catalogo", `/produtos/${a.id_produto}/cores`));
    }
    const produto = produtos.get(a.id_produto);
    if (!produto?.ativo) continue;

    if (!nomes.has(a.id_usuario)) {
      const usuario = await consultarOuNull<{ nome: string }>("identidade", `/usuarios/${a.id_usuario}`);
      nomes.set(a.id_usuario, primeiroNome(usuario?.nome));
    }
    const foto = await AvaliacaoFotos.findOne({ where: { id_avaliacao_produto: a.id_avaliacao_produto }, order: [["id_avaliacao_foto", "ASC"]] });

    dados.push({
      id_avaliacao_produto: a.id_avaliacao_produto,
      id_produto: a.id_produto,
      produto: produto.nome,
      nome: nomes.get(a.id_usuario),
      nota: Number(a.nota),
      titulo: a.titulo,
      comentario: a.comentario,
      foto: foto?.caminho_url ?? null,
    });
    if (dados.length >= LIMITE) break;
  }

  cache = { ate: Date.now() + VALIDADE_MS, dados };
  logger.info("avaliacoes.destaques", { total: dados.length });
  return dados;
}

export const limparCacheDestaques = () => {
  cache = null;
};
