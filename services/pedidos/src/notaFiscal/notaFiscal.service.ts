import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { DataTypes, Model } from "sequelize";
import sequelize from "@agnus/comum/config/database";
import { getPermissionsForRole, PERMISSIONS } from "@agnus/comum/config/permissions";
import type { AuthUserPayload } from "@agnus/comum/types/auth.types";
import { HttpError } from "@agnus/comum/types/http_error";
import { chamarServico } from "@agnus/comum/utils/clienteInterno";
import logger from "@agnus/comum/utils/logger";
import Pedidos from "../models/Pedidos";
import { chaveValida, formatarChave, lerXmlDaNota, normalizarChave, pareceSerPdf, pareceXmlDeNota } from "./notaFiscal.regras";

// NF-e do pedido: a equipe anexa o DANFE (PDF) e/ou o XML autorizado; o cliente vê e baixa em
// "Meus pedidos". Os arquivos ficam no volume notas_fiscais e só saem com login (dono ou equipe).

export const PASTA_NOTAS = path.resolve(process.cwd(), "notas_fiscais");
const MAX_BYTES = 5 * 1024 * 1024;
const ARQUIVO_VALIDO = /^[0-9a-f-]{36}\.(pdf|xml)$/;
const STATUS_SEM_NOTA = ["aguardando_calculo_frete", "aguardando_pagamento", "cancelado"];

export class NotasFiscais extends Model {
  declare id_pedido: number;
  declare chave: string;
  declare numero: string | null;
  declare serie: string | null;
  declare data_emissao: Date | null;
  declare valor: number | string | null;
  declare arquivo_pdf: string | null;
  declare arquivo_xml: string | null;
  declare data_criacao: Date;
  declare data_alteracao: Date;
}

NotasFiscais.init(
  {
    id_pedido: { type: DataTypes.INTEGER, primaryKey: true },
    chave: { type: DataTypes.CHAR(44), allowNull: false },
    numero: { type: DataTypes.STRING(12), allowNull: true },
    serie: { type: DataTypes.STRING(4), allowNull: true },
    data_emissao: { type: DataTypes.DATE, allowNull: true },
    valor: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    arquivo_pdf: { type: DataTypes.STRING(100), allowNull: true },
    arquivo_xml: { type: DataTypes.STRING(100), allowNull: true },
    data_criacao: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    data_alteracao: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { sequelize, tableName: "pedidos_notas_fiscais", timestamps: false },
);

// Base64 puro ou "data:...;base64,...".
const bytesDoBase64 = (valor: unknown, rotulo: string) => {
  if (typeof valor !== "string" || !valor) return null;
  const conteudo = valor.replace(/^data:[^;,]+;base64,/, "").replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(conteudo)) throw new HttpError(400, `${rotulo} inválido.`);
  const bytes = Buffer.from(conteudo, "base64");
  if (bytes.length === 0) throw new HttpError(400, `${rotulo} inválido.`);
  if (bytes.length > MAX_BYTES) throw new HttpError(413, `${rotulo} muito grande (máximo de 5 MB).`);
  return bytes;
};

const gravar = async (bytes: Buffer, extensao: "pdf" | "xml") => {
  await fs.mkdir(PASTA_NOTAS, { recursive: true });
  const arquivo = `${randomUUID()}.${extensao}`;
  await fs.writeFile(path.join(PASTA_NOTAS, arquivo), bytes, { flag: "wx" });
  return arquivo;
};

const caminho = (arquivo: string) => {
  if (!ARQUIVO_VALIDO.test(arquivo)) throw new HttpError(404, "Arquivo da nota não encontrado.");
  return path.join(PASTA_NOTAS, arquivo);
};

const apagar = async (arquivo: string | null) => {
  if (!arquivo) return;
  try {
    await fs.unlink(caminho(arquivo));
  } catch {
    // Já não existia.
  }
};

export const resumoDaNota = (nota: NotasFiscais) => ({
  chave: nota.chave,
  chave_formatada: formatarChave(nota.chave),
  numero: nota.numero,
  serie: nota.serie,
  data_emissao: nota.data_emissao,
  valor: nota.valor == null ? null : Number(nota.valor),
  tem_pdf: Boolean(nota.arquivo_pdf),
  tem_xml: Boolean(nota.arquivo_xml),
});

const ehEquipe = (quem: AuthUserPayload) => getPermissionsForRole(quem.tipo).includes(PERMISSIONS.PEDIDO_ATUALIZAR);

class NotaFiscalService {
  // Resumo das notas de vários pedidos de uma vez (listas de pedidos).
  static async resumos(idsPedidos: number[]) {
    if (idsPedidos.length === 0) return new Map<number, ReturnType<typeof resumoDaNota>>();
    const notas = await NotasFiscais.findAll({ where: { id_pedido: idsPedidos } });
    return new Map(notas.map((n) => [n.id_pedido, resumoDaNota(n)]));
  }

  private static async pedidoVisivel(idPedido: number, quem: AuthUserPayload) {
    const pedido = await Pedidos.findByPk(idPedido);
    // 404 também para pedido de outra pessoa: não revela que existe.
    if (!pedido || (pedido.id_usuario !== quem.id_usuario && !ehEquipe(quem))) {
      throw new HttpError(404, "Pedido não encontrado.");
    }
    return pedido;
  }

  static async daPedido(idPedido: number, quem: AuthUserPayload) {
    await NotaFiscalService.pedidoVisivel(idPedido, quem);
    const nota = await NotasFiscais.findByPk(idPedido);
    if (!nota) throw new HttpError(404, "A nota fiscal deste pedido ainda não foi emitida.");
    return resumoDaNota(nota);
  }

  static async arquivo(idPedido: number, tipo: "pdf" | "xml", quem: AuthUserPayload) {
    await NotaFiscalService.pedidoVisivel(idPedido, quem);
    const nota = await NotasFiscais.findByPk(idPedido);
    const arquivo = tipo === "pdf" ? nota?.arquivo_pdf : nota?.arquivo_xml;
    if (!nota || !arquivo) throw new HttpError(404, "Arquivo da nota não encontrado.");
    return {
      caminho: caminho(arquivo),
      tipo: tipo === "pdf" ? "application/pdf" : "application/xml",
      nome: `NF-e-${nota.numero ?? nota.chave.slice(25, 34)}-pedido-${idPedido}.${tipo}`,
    };
  }

  // Equipe: anexa ou troca a nota. Com XML, chave, número, série, data e valor vêm dele.
  static async salvar(idPedido: number, corpo: Record<string, unknown>) {
    const pedido = await Pedidos.findByPk(idPedido);
    if (!pedido) throw new HttpError(404, "Pedido não encontrado.");
    if (STATUS_SEM_NOTA.includes(pedido.status)) {
      throw new HttpError(409, "A nota fiscal só pode ser anexada depois que o pedido for pago.");
    }

    const pdf = bytesDoBase64(corpo.pdf, "PDF");
    const xml = bytesDoBase64(corpo.xml, "XML");
    if (pdf && !pareceSerPdf(pdf)) throw new HttpError(400, "O arquivo do DANFE precisa ser um PDF.");

    const textoXml = xml?.toString("utf8") ?? null;
    if (textoXml !== null && !pareceXmlDeNota(textoXml)) throw new HttpError(400, "O XML enviado não é de uma NF-e.");
    const dadosXml = textoXml ? lerXmlDaNota(textoXml) : null;

    const anterior = await NotasFiscais.findByPk(idPedido);
    const digitada = normalizarChave(corpo.chave);
    const chave = dadosXml?.chave ?? (digitada || anterior?.chave || "");
    if (dadosXml?.chave && digitada && digitada !== dadosXml.chave) {
      throw new HttpError(400, "A chave digitada é diferente da chave do XML.");
    }
    if (!chaveValida(chave)) throw new HttpError(400, "Chave de acesso inválida: confira os 44 números.");
    if (!pdf && !xml && !anterior) throw new HttpError(400, "Anexe o PDF (DANFE) ou o XML da nota.");

    const arquivoPdf = pdf ? await gravar(pdf, "pdf") : null;
    const arquivoXml = xml ? await gravar(xml, "xml") : null;
    const texto = (valor: unknown, max: number) => (typeof valor === "string" && valor.trim() ? valor.trim().slice(0, max) : null);

    const dados = {
      chave,
      numero: dadosXml?.numero ?? texto(corpo.numero, 12) ?? anterior?.numero ?? null,
      serie: dadosXml?.serie ?? texto(corpo.serie, 4) ?? anterior?.serie ?? null,
      data_emissao: dadosXml?.data_emissao ?? anterior?.data_emissao ?? null,
      valor: dadosXml?.valor ?? anterior?.valor ?? null,
      arquivo_pdf: arquivoPdf ?? anterior?.arquivo_pdf ?? null,
      arquivo_xml: arquivoXml ?? anterior?.arquivo_xml ?? null,
      data_alteracao: new Date(),
    };

    // Nomes dos arquivos antigos guardados antes do update (depois dele o registro já aponta para os novos).
    const antigos = { pdf: anterior?.arquivo_pdf ?? null, xml: anterior?.arquivo_xml ?? null };

    try {
      if (anterior) await anterior.update(dados);
      else await NotasFiscais.create({ id_pedido: idPedido, ...dados });
    } catch (error) {
      await Promise.all([apagar(arquivoPdf), apagar(arquivoXml)]);
      throw error;
    }

    // Arquivo trocado: o antigo sai do disco.
    if (arquivoPdf && antigos.pdf !== arquivoPdf) await apagar(antigos.pdf);
    if (arquivoXml && antigos.xml !== arquivoXml) await apagar(antigos.xml);

    logger.info("nota_fiscal.anexada", { pedido: idPedido, nova: !anterior });
    if (!anterior) NotaFiscalService.avisarCliente(pedido);

    return resumoDaNota((await NotasFiscais.findByPk(idPedido))!);
  }

  static async remover(idPedido: number) {
    const nota = await NotasFiscais.findByPk(idPedido);
    if (!nota) throw new HttpError(404, "Este pedido não tem nota fiscal.");
    await nota.destroy();
    await Promise.all([apagar(nota.arquivo_pdf), apagar(nota.arquivo_xml)]);
    logger.info("nota_fiscal.removida", { pedido: idPedido });
  }

  // Aviso no site e por e-mail; a falha só é registrada (a nota já está disponível em Meus pedidos).
  private static avisarCliente(pedido: Pedidos) {
    chamarServico("notificacoes", "/nota-fiscal", {
      method: "POST",
      body: { id_usuario: pedido.id_usuario, id_pedido: pedido.id_pedido },
      timeoutMs: 5000,
    }).catch((error) =>
      logger.warn("nota_fiscal.aviso_falhou", { pedido: pedido.id_pedido, error: error instanceof Error ? error.message : String(error) }),
    );
  }
}

export default NotaFiscalService;
