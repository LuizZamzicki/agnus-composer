import { randomUUID } from "crypto";
import { QueryTypes } from "sequelize";
import sequelize from "@agnus/comum/config/database";
import { HttpError } from "@agnus/comum/types/http_error";
import { chamarServico } from "@agnus/comum/utils/clienteInterno";
import { consultarSelecoes } from "@agnus/comum/utils/itemDetails";
import logger from "@agnus/comum/utils/logger";
import CarrinhoItens from "../models/CarrinhoItens";
import Carrinhos from "../models/Carrinhos";

// Sacola esquecida: quem entrou na conta, pôs peças na sacola e não comprou recebe um e-mail uma
// hora depois e outro no dia seguinte. Mexer na sacola recomeça a contagem; comprar a esvazia
// (o checkout baixa os itens), então não há lembrete depois da compra. Sacola parada há mais de
// uma semana fica de fora. A sacola do visitante (sem conta) fica no navegador e não entra.
const HORA_MS = 60 * 60 * 1000;
export const PRIMEIRO_LEMBRETE_MS = HORA_MS;
export const SEGUNDO_LEMBRETE_MS = 24 * HORA_MS;
export const JANELA_MS = 7 * 24 * HORA_MS;
const LIMITE_POR_RODADA = 50;
const MAX_PECAS_NO_EMAIL = 6;

export type SacolaParada = {
  id_carrinho: number;
  id_usuario: number;
  lembretes_enviados: number;
  lembrete_em: Date | string | null;
  token_lembrete: string | null;
  ultima_mudanca: Date | string;
};

const instante = (valor: Date | string | null) => (valor ? new Date(valor).getTime() : NaN);

// Qual lembrete a sacola deve receber agora (1 ou 2), ou null.
export const proximoLembrete = (sacola: SacolaParada, agora = Date.now()): 1 | 2 | null => {
  const ultima = instante(sacola.ultima_mudanca);
  if (Number.isNaN(ultima)) return null;

  const parada = agora - ultima;
  if (parada > JANELA_MS) return null;

  // Lembrete enviado antes da última mudança não conta: a sacola mudou, a contagem recomeça.
  const enviados = instante(sacola.lembrete_em) >= ultima ? Number(sacola.lembretes_enviados) || 0 : 0;

  if (enviados === 0 && parada >= PRIMEIRO_LEMBRETE_MS) return 1;
  if (enviados === 1 && parada >= SEGUNDO_LEMBRETE_MS) return 2;
  return null;
};

type PecaDoLembrete = { id_produto: number; nome: string; cor: string | null; tamanho: string | null; foto: string | null; preco: number };

const pecasDaSacola = async (idCarrinho: number): Promise<PecaDoLembrete[]> => {
  const itens = await CarrinhoItens.findAll({ where: { id_carrinho: idCarrinho }, order: [["id_carrinho_item", "ASC"]] });
  if (!itens.length) return [];

  const selecoes = await consultarSelecoes(itens);
  return selecoes
    .map((selecao, indice): PecaDoLembrete | null => {
      const contexto = selecao?.contexto;
      if (!contexto || !contexto.produto.ativo) return null;
      return {
        id_produto: contexto.produto.id_produto,
        nome: contexto.produto.nome,
        cor: contexto.cor?.nome ?? null,
        tamanho: contexto.grade?.nome ?? null,
        foto: contexto.foto,
        preco: Math.round(contexto.precoUnitario * (Number(itens[indice].quantidade) || 1) * 100) / 100,
      };
    })
    .filter((peca): peca is PecaDoLembrete => peca !== null)
    .slice(0, MAX_PECAS_NO_EMAIL);
};

class LembreteSacolaService {
  static async paradas(agora = new Date()) {
    return sequelize.query<SacolaParada>(
      `SELECT c.id_carrinho, c.id_usuario, c.lembretes_enviados, c.lembrete_em, c.token_lembrete,
              MAX(GREATEST(COALESCE(i.data_criacao, '1970-01-01'), COALESCE(i.data_alteracao, '1970-01-01'))) AS ultima_mudanca
         FROM carrinhos c
         JOIN carrinho_itens i ON i.id_carrinho = c.id_carrinho
        WHERE NOT EXISTS (SELECT 1 FROM sacola_lembretes_cancelados s WHERE s.id_usuario = c.id_usuario)
        GROUP BY c.id_carrinho, c.id_usuario, c.lembretes_enviados, c.lembrete_em, c.token_lembrete
       HAVING ultima_mudanca BETWEEN :desde AND :ate
        ORDER BY c.id_carrinho ASC
        LIMIT ${LIMITE_POR_RODADA}`,
      {
        type: QueryTypes.SELECT,
        replacements: { desde: new Date(agora.getTime() - JANELA_MS), ate: new Date(agora.getTime() - PRIMEIRO_LEMBRETE_MS) },
      },
    );
  }

  static async rodar(agora = new Date()) {
    const sacolas = await LembreteSacolaService.paradas(agora);
    let enviados = 0;

    for (const sacola of sacolas) {
      const etapa = proximoLembrete(sacola, agora.getTime());
      if (!etapa) continue;

      try {
        const token = sacola.token_lembrete ?? randomUUID();
        const pecas = await pecasDaSacola(sacola.id_carrinho);

        if (pecas.length) {
          await chamarServico("notificacoes", "/sacola-esquecida", {
            method: "POST",
            body: { id_usuario: sacola.id_usuario, etapa, token, pecas },
            timeoutMs: 10000,
          });
          enviados += 1;
        }

        // Marca mesmo sem peças disponíveis: não adianta tentar de novo a cada rodada.
        await Carrinhos.update(
          { lembretes_enviados: etapa, lembrete_em: agora, token_lembrete: token },
          { where: { id_carrinho: sacola.id_carrinho } },
        );
      } catch (error) {
        // Fica para a próxima rodada.
        logger.warn("sacola.lembrete_falhou", { carrinho: sacola.id_carrinho, error: error instanceof Error ? error.message : String(error) });
      }
    }

    return { verificados: sacolas.length, enviados };
  }

  // Link "não quero mais receber" do e-mail: vale para todas as sacolas da pessoa.
  static async cancelar(tokenInformado: unknown) {
    const token = typeof tokenInformado === "string" ? tokenInformado.trim() : "";

    if (!/^[0-9a-f-]{36}$/i.test(token)) {
      throw new HttpError(400, "Link de cancelamento inválido.");
    }

    const carrinho = await Carrinhos.findOne({ where: { token_lembrete: token } });

    if (!carrinho) {
      throw new HttpError(404, "Link de cancelamento não encontrado.");
    }

    await sequelize.query("INSERT IGNORE INTO `sacola_lembretes_cancelados` (`id_usuario`) VALUES (:id)", {
      replacements: { id: carrinho.id_usuario },
    });
    logger.info("sacola.lembretes_cancelados", { usuario: carrinho.id_usuario });
  }
}

export const iniciarLembretesDeSacola = () => {
  const rodar = () =>
    LembreteSacolaService.rodar()
      .then((r) => r.enviados && logger.info("sacola.lembretes_enviados", r))
      .catch((error) => logger.warn("sacola.rodada_falhou", { error: error instanceof Error ? error.message : String(error) }));
  setTimeout(rodar, 120_000).unref();
  setInterval(rodar, 15 * 60_000).unref();
};

export default LembreteSacolaService;
