import { randomUUID } from "crypto";
import { DataTypes, Model, Op } from "sequelize";
import sequelize from "@agnus/comum/config/database";
import { HttpError } from "@agnus/comum/types/http_error";
import { chamarServico } from "@agnus/comum/utils/clienteInterno";
import logger from "@agnus/comum/utils/logger";
import Pedidos from "../models/Pedidos";
import { DESCONTO_PRIMEIRA_COMPRA, EMAIL_VALIDO, STATUS_DE_COMPRA, gerarCupom, normalizarCupom, normalizarEmail } from "./ofertas.regras";

export { DESCONTO_PRIMEIRA_COMPRA, FRETE_GRATIS_ACIMA, gerarCupom, normalizarCupom, normalizarEmail, resumoDaCompra } from "./ofertas.regras";

export class OfertasInscricoes extends Model {
  declare id_inscricao: number;
  declare email: string;
  declare cupom_codigo: string;
  declare token_cancelar: string;
  declare ativo: boolean;
  declare origem: string;
  declare data_criacao: Date;
  declare data_cancelamento: Date | null;
}

OfertasInscricoes.init(
  {
    id_inscricao: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    email: { type: DataTypes.STRING(180), allowNull: false, unique: true },
    cupom_codigo: { type: DataTypes.STRING(40), allowNull: false, unique: true },
    token_cancelar: { type: DataTypes.CHAR(36), allowNull: false, unique: true },
    ativo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    origem: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "home" },
    data_criacao: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    data_cancelamento: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
  },
  { sequelize, tableName: "ofertas_inscricoes", timestamps: false },
);

export type CupomValido = { codigo: string; percentual: number };

const avisarInscricao = (inscricao: OfertasInscricoes) => {
  chamarServico("notificacoes", "/ofertas/boas-vindas", {
    method: "POST",
    body: { email: inscricao.email, cupom: inscricao.cupom_codigo, token: inscricao.token_cancelar, percentual: DESCONTO_PRIMEIRA_COMPRA },
    timeoutMs: 5000,
  }).catch((error) =>
    logger.warn("ofertas.aviso_falhou", { inscricao: inscricao.id_inscricao, error: error instanceof Error ? error.message : String(error) }),
  );
};

class OfertasService {
  static async inscrever(emailInformado: unknown, origem = "home") {
    const email = normalizarEmail(emailInformado);

    if (!EMAIL_VALIDO.test(email) || email.length > 180) {
      throw new HttpError(400, "Informe um e-mail válido.");
    }

    const existente = await OfertasInscricoes.findOne({ where: { email } });

    if (existente?.ativo) {
      return { inscricao: existente, nova: false };
    }

    if (existente) {
      await existente.update({ ativo: true, data_cancelamento: null });
      avisarInscricao(existente);
      return { inscricao: existente, nova: true };
    }

    for (let tentativa = 0; tentativa < 5; tentativa += 1) {
      try {
        const inscricao = await OfertasInscricoes.create({
          email,
          cupom_codigo: gerarCupom(),
          token_cancelar: randomUUID(),
          origem: origem.slice(0, 30),
        });
        avisarInscricao(inscricao);
        logger.info("ofertas.inscricao", { inscricao: inscricao.id_inscricao, origem });
        return { inscricao, nova: true };
      } catch (error) {
        // Corrida com outra inscrição do mesmo e-mail ou código repetido: tenta de novo.
        const repetido = (error as { name?: string })?.name === "SequelizeUniqueConstraintError";
        if (!repetido) throw error;
        const outra = await OfertasInscricoes.findOne({ where: { email } });
        if (outra) return { inscricao: outra, nova: false };
      }
    }

    throw new HttpError(503, "Não foi possível concluir a inscrição. Tente de novo.");
  }

  static async cancelar(token: unknown) {
    const valor = typeof token === "string" ? token.trim() : "";

    if (!/^[0-9a-f-]{36}$/i.test(valor)) {
      throw new HttpError(400, "Link de cancelamento inválido.");
    }

    const inscricao = await OfertasInscricoes.findOne({ where: { token_cancelar: valor } });

    if (!inscricao) {
      throw new HttpError(404, "Inscrição não encontrada.");
    }

    if (inscricao.ativo) {
      await inscricao.update({ ativo: false, data_cancelamento: new Date() });
    }

    return { email: inscricao.email.replace(/^(.).*(@.*)$/, "$1***$2") };
  }

  // O cupom vale uma vez, só na primeira compra da conta e não soma com outro cupom. Um pedido
  // cancelado devolve o cupom (ele só conta como usado em pedido que não foi cancelado).
  static async validarCupom(idUsuario: number, codigoInformado: unknown): Promise<CupomValido> {
    const codigo = normalizarCupom(codigoInformado);

    if (!codigo) {
      throw new HttpError(400, "Digite o código do cupom.");
    }

    const inscricao = await OfertasInscricoes.findOne({ where: { cupom_codigo: codigo } });

    if (!inscricao) {
      throw new HttpError(404, "Cupom não encontrado. Confira o código.");
    }

    const naoCancelado = { status: { [Op.ne]: "cancelado" } };
    const [jaUsado, jaComprou, outroCupom] = await Promise.all([
      Pedidos.count({ where: { cupom_codigo: codigo, ...naoCancelado } }),
      Pedidos.count({ where: { id_usuario: idUsuario, status: STATUS_DE_COMPRA } }),
      Pedidos.count({ where: { id_usuario: idUsuario, cupom_codigo: { [Op.ne]: null }, ...naoCancelado } }),
    ]);

    if (jaUsado) {
      throw new HttpError(409, "Este cupom já foi usado.");
    }

    if (jaComprou || outroCupom) {
      throw new HttpError(409, "Este cupom vale só para a primeira compra.");
    }

    return { codigo, percentual: DESCONTO_PRIMEIRA_COMPRA };
  }
}

export default OfertasService;
