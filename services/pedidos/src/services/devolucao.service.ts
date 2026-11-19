import { Op, Transaction } from "sequelize";
import sequelize from "@agnus/comum/config/database";
import { HttpError } from "@agnus/comum/types/http_error";
import { chamarServico } from "@agnus/comum/utils/clienteInterno";
import logger from "@agnus/comum/utils/logger";
import { enrichItemsWithProductData } from "@agnus/comum/utils/itemDetails";
import { getPermissionsForRole, PERMISSIONS } from "@agnus/comum/config/permissions";
import type { AuthUserPayload } from "@agnus/comum/types/auth.types";
import { DevolucaoFotos, DevolucaoItens, Devolucoes, type MotivoDevolucao, type StatusDevolucao } from "../models/Devolucoes";
import { apagarFoto, caminhoDaFoto, gravarFoto, lerFotoEnviada, MAX_FOTOS_POR_DEVOLUCAO, tipoDoArquivo } from "../utils/devolucaoFotoStorage";
import Pagamentos from "../models/Pagamentos";
import PedidoItens from "../models/PedidoItens";
import Pedidos from "../models/Pedidos";
import { criarReembolso } from "../pagamentos/mercadoPago";
import { fatorPago } from "./pedidoRegras.service";

const DIA_MS = 24 * 60 * 60 * 1000;
const STATUS_EM_ANDAMENTO: StatusDevolucao[] = ["solicitada", "aprovada", "recebida"];
// Recusada ou cancelada não "gasta" as peças: o cliente pode pedir de novo dentro do prazo.
const STATUS_QUE_CONTAM: StatusDevolucao[] = ["solicitada", "aprovada", "recebida", "reembolsada"];

const dias = (nome: string, padrao: number) => {
  const n = Number(process.env[nome]);
  return Number.isInteger(n) && n >= 1 && n <= 365 ? n : padrao;
};

// Arrependimento: 7 dias da entrega (CDC art. 49). Defeito ou produto errado: 90 dias (CDC art. 26, II).
// "Tamanho não serviu" segue o arrependimento.
export const MOTIVOS: Record<MotivoDevolucao, { rotulo: string; prazoDias: () => number }> = {
  arrependimento: { rotulo: "Desisti da compra", prazoDias: () => dias("DEVOLUCAO_PRAZO_ARREPENDIMENTO_DIAS", 7) },
  tamanho: { rotulo: "O tamanho não serviu", prazoDias: () => dias("DEVOLUCAO_PRAZO_ARREPENDIMENTO_DIAS", 7) },
  defeito: { rotulo: "A peça veio com defeito", prazoDias: () => dias("DEVOLUCAO_PRAZO_DEFEITO_DIAS", 90) },
  produto_errado: { rotulo: "Recebi a peça errada", prazoDias: () => dias("DEVOLUCAO_PRAZO_DEFEITO_DIAS", 90) },
};

export const ROTULO_STATUS: Record<StatusDevolucao, string> = {
  solicitada: "Em análise",
  aprovada: "Aprovada: aguardando o envio da peça",
  recusada: "Recusada",
  recebida: "Peça recebida: reembolso em andamento",
  reembolsada: "Reembolsada",
  cancelada: "Cancelada",
};

const dinheiro = (valor: number) => Math.round(valor * 100) / 100;
const texto = (valor: unknown, max: number) => (typeof valor === "string" ? valor.trim().slice(0, max) : "");

type Comprador = { id_usuario: number };
type Resumo = { id_produto: number | null; nome_produto: string; cor: string | null; tamanho: string | null; foto_produto: string | null };

const dataDeEntrega = (pedido: Pedidos) => (pedido.data_entrega ? new Date(pedido.data_entrega) : null);

const prazoAte = (pedido: Pedidos, motivo: MotivoDevolucao) => {
  const entrega = dataDeEntrega(pedido);
  return entrega ? new Date(entrega.getTime() + MOTIVOS[motivo].prazoDias() * DIA_MS) : null;
};

// Quantas unidades de cada item do pedido já estão numa devolução (em andamento ou reembolsada).
const quantidadesJaDevolvidas = async (idPedido: number, transaction?: Transaction) => {
  const devolucoes = await Devolucoes.findAll({
    where: { id_pedido: idPedido, status: { [Op.in]: STATUS_QUE_CONTAM } },
    attributes: ["id_devolucao"],
    transaction,
  });
  const itens = devolucoes.length
    ? await DevolucaoItens.findAll({ where: { id_devolucao: { [Op.in]: devolucoes.map((d) => d.id_devolucao) } }, transaction })
    : [];

  const porItem = new Map<number, number>();
  for (const item of itens) {
    porItem.set(item.id_pedido_item, (porItem.get(item.id_pedido_item) ?? 0) + Number(item.quantidade));
  }
  return porItem;
};

const resumoDoItem = (item: unknown): Resumo => {
  const detalhe = item as {
    produto?: { id_produto?: number; nome?: string } | null;
    cor?: { nome?: string } | null;
    grade?: { nome?: string } | null;
    foto_produto?: string | null;
  };
  return {
    id_produto: detalhe?.produto?.id_produto ?? null,
    nome_produto: detalhe?.produto?.nome ?? "Produto",
    cor: detalhe?.cor?.nome ?? null,
    tamanho: detalhe?.grade?.nome ?? null,
    foto_produto: detalhe?.foto_produto ?? null,
  };
};

const serializar = async (devolucao: Devolucoes) => {
  const mapa = await detalharItens(await PedidoItens.findAll({ where: { id_pedido: devolucao.id_pedido } }));

  return {
    id_devolucao: devolucao.id_devolucao,
    id_pedido: devolucao.id_pedido,
    id_usuario: devolucao.id_usuario,
    status: devolucao.status,
    status_rotulo: ROTULO_STATUS[devolucao.status],
    motivo: devolucao.motivo,
    motivo_rotulo: MOTIVOS[devolucao.motivo].rotulo,
    descricao: devolucao.descricao,
    valor_reembolso: Number(devolucao.valor_reembolso),
    resposta_loja: devolucao.resposta_loja,
    codigo_postagem: devolucao.codigo_postagem,
    forma_reembolso: devolucao.forma_reembolso,
    referencia_reembolso: devolucao.referencia_reembolso,
    data_solicitacao: devolucao.data_solicitacao,
    data_resposta: devolucao.data_resposta,
    data_recebimento: devolucao.data_recebimento,
    data_reembolso: devolucao.data_reembolso,
    itens: (devolucao.itens ?? []).map((item) => ({
      id_pedido_item: item.id_pedido_item,
      quantidade: item.quantidade,
      valor: Number(item.valor),
      ...(mapa.get(item.id_pedido_item) ?? resumoDoItem(null)),
    })),
    // Só o endereço da rota autenticada; o nome do arquivo no disco não sai na API.
    fotos: (devolucao.fotos ?? []).map((foto) => ({
      id_devolucao_foto: foto.id_devolucao_foto,
      url: `/api/devolucao-fotos/${foto.id_devolucao_foto}`,
    })),
  };
};

// Nome, cor, tamanho e foto de cada item do pedido, por id_pedido_item.
const detalharItens = async (itens: PedidoItens[]) => {
  const enriquecidos = await enrichItemsWithProductData(itens);
  return new Map(itens.map((item, indice) => [item.id_pedido_item, resumoDoItem(enriquecidos[indice])]));
};

// Avisos: cliente (site + e-mail) e programa de afiliados (a comissão segue a devolução).
// Falha só vai para o log; a devolução nunca depende deles.
const avisar = async (devolucao: Devolucoes, pedido: Pedidos) => {
  try {
    await chamarServico("notificacoes", "/devolucao", {
      method: "POST",
      body: {
        id_usuario: devolucao.id_usuario,
        id_pedido: devolucao.id_pedido,
        id_devolucao: devolucao.id_devolucao,
        status: devolucao.status,
        valor_reembolso: Number(devolucao.valor_reembolso),
        resposta_loja: devolucao.resposta_loja,
        codigo_postagem: devolucao.codigo_postagem,
      },
    });
  } catch (error) {
    logger.warn("devolucao.falha_ao_avisar_cliente", { devolucao: devolucao.id_devolucao, error: error instanceof Error ? error.message : String(error) });
  }

  if (!pedido.ref_afiliado) return;

  const evento =
    devolucao.status === "solicitada" ? "aberta" : devolucao.status === "reembolsada" ? "reembolsada" : devolucao.status === "recusada" || devolucao.status === "cancelada" ? "encerrada" : null;
  if (!evento) return;

  try {
    const detalhes = await detalharItens(await PedidoItens.findAll({ where: { id_pedido: pedido.id_pedido } }));
    await chamarServico("afiliados", "/conversoes/devolucao", {
      method: "POST",
      body: {
        id_pedido: pedido.id_pedido,
        evento,
        itens: (devolucao.itens ?? []).map((item) => ({
          id_produto: detalhes.get(item.id_pedido_item)?.id_produto ?? null,
          valor: Number(item.valor),
        })),
      },
    });
  } catch (error) {
    logger.warn("devolucao.falha_ao_avisar_afiliados", { devolucao: devolucao.id_devolucao, error: error instanceof Error ? error.message : String(error) });
  }
};

const INCLUIR = [
  { model: DevolucaoItens, as: "itens" },
  { model: DevolucaoFotos, as: "fotos" },
];

const buscarComItens = (id: number, transaction?: Transaction) => Devolucoes.findByPk(id, { include: INCLUIR, transaction });

class DevolucaoService {
  // O que o cliente pode devolver deste pedido (para montar o formulário).
  static async opcoes(idPedido: number, comprador: Comprador) {
    const pedido = await Pedidos.findByPk(idPedido);
    if (!pedido || pedido.id_usuario !== comprador.id_usuario) throw new HttpError(404, "Pedido não encontrado.");

    const emAndamento = await Devolucoes.findOne({ where: { id_pedido: idPedido, status: { [Op.in]: STATUS_EM_ANDAMENTO } } });
    const agora = Date.now();
    const motivos = (Object.keys(MOTIVOS) as MotivoDevolucao[]).map((motivo) => {
      const ate = prazoAte(pedido, motivo);
      return { valor: motivo, rotulo: MOTIVOS[motivo].rotulo, prazo_dias: MOTIVOS[motivo].prazoDias(), disponivel_ate: ate, disponivel: Boolean(ate && ate.getTime() >= agora) };
    });

    const itensDoPedido = await PedidoItens.findAll({ where: { id_pedido: idPedido } });
    const detalhes = await detalharItens(itensDoPedido);
    const jaDevolvidas = await quantidadesJaDevolvidas(idPedido);
    const fator = fatorPago(pedido, itensDoPedido);
    const itens = itensDoPedido.map((item) => {
      const comprada = Number(item.quantidade ?? 1);
      return {
        id_pedido_item: item.id_pedido_item,
        ...(detalhes.get(item.id_pedido_item) ?? resumoDoItem(null)),
        // Valor pago por unidade (com cupom, já sem a parte do desconto): é o que volta no reembolso.
        preco_unitario: dinheiro(Number(item.preco_unitario) * fator),
        quantidade_comprada: comprada,
        quantidade_devolvivel: Math.max(0, comprada - (jaDevolvidas.get(item.id_pedido_item) ?? 0)),
      };
    });

    const motivoInelegivel =
      pedido.status !== "entregue"
        ? "A devolução fica disponível depois que o pedido é entregue."
        : emAndamento
          ? "Já existe uma devolução em andamento para este pedido."
          : !motivos.some((m) => m.disponivel)
            ? "O prazo para devolução deste pedido terminou."
            : !itens.some((i) => i.quantidade_devolvivel > 0)
              ? "Todas as peças deste pedido já foram devolvidas."
              : null;

    return {
      id_pedido: idPedido,
      elegivel: !motivoInelegivel,
      motivo_inelegivel: motivoInelegivel,
      data_entrega: dataDeEntrega(pedido),
      motivos,
      itens,
      devolucao_em_andamento: emAndamento ? emAndamento.id_devolucao : null,
    };
  }

  static async solicitar(idPedido: number, comprador: Comprador, corpo: Record<string, unknown>) {
    const motivo = corpo.motivo as MotivoDevolucao;
    if (!MOTIVOS[motivo]) throw new HttpError(400, "Escolha o motivo da devolução.");

    const descricao = texto(corpo.descricao, 1000);
    if ((motivo === "defeito" || motivo === "produto_errado") && descricao.length < 10) {
      throw new HttpError(400, "Conte o que aconteceu com a peça (pelo menos 10 caracteres).");
    }

    const pedidos = Array.isArray(corpo.itens) ? (corpo.itens as { id_pedido_item?: unknown; quantidade?: unknown }[]) : [];
    if (pedidos.length === 0) throw new HttpError(400, "Escolha as peças que quer devolver.");

    const devolucao = await sequelize.transaction(async (transaction) => {
      // Trava o pedido: duas abas enviando ao mesmo tempo não abrem duas devoluções.
      const pedido = await Pedidos.findByPk(idPedido, { lock: transaction.LOCK.UPDATE, transaction });
      if (!pedido || pedido.id_usuario !== comprador.id_usuario) throw new HttpError(404, "Pedido não encontrado.");
      if (pedido.status !== "entregue") throw new HttpError(409, "A devolução fica disponível depois que o pedido é entregue.");

      const ate = prazoAte(pedido, motivo);
      if (!ate || ate.getTime() < Date.now()) {
        throw new HttpError(409, `O prazo para "${MOTIVOS[motivo].rotulo.toLowerCase()}" é de ${MOTIVOS[motivo].prazoDias()} dias após a entrega e já terminou.`);
      }

      if (await Devolucoes.findOne({ where: { id_pedido: idPedido, status: { [Op.in]: STATUS_EM_ANDAMENTO } }, transaction })) {
        throw new HttpError(409, "Já existe uma devolução em andamento para este pedido.");
      }

      const itensDoPedido = new Map((await PedidoItens.findAll({ where: { id_pedido: idPedido }, transaction })).map((i) => [i.id_pedido_item, i]));
      const jaDevolvidas = await quantidadesJaDevolvidas(idPedido, transaction);
      const escolhidos = new Map<number, number>();

      for (const escolhido of pedidos) {
        const id = Number(escolhido.id_pedido_item);
        const quantidade = Number(escolhido.quantidade ?? 1);
        const item = itensDoPedido.get(id);

        if (!item || !Number.isInteger(quantidade) || quantidade < 1) throw new HttpError(400, "Peça ou quantidade inválida.");
        escolhidos.set(id, (escolhidos.get(id) ?? 0) + quantidade);

        const disponivel = Number(item.quantidade ?? 1) - (jaDevolvidas.get(id) ?? 0);
        if (escolhidos.get(id)! > disponivel) throw new HttpError(400, `Você pode devolver no máximo ${Math.max(0, disponivel)} unidade(s) dessa peça.`);
      }

      // Com cupom, cada peça devolve o que foi pago por ela (preço menos a parte do desconto).
      const fator = fatorPago(pedido, [...itensDoPedido.values()]);
      const linhas = [...escolhidos].map(([id, quantidade]) => ({
        id_pedido_item: id,
        quantidade,
        valor: dinheiro(Number(itensDoPedido.get(id)!.preco_unitario) * quantidade * fator),
      }));

      // Se com esta devolução todas as peças voltam, o frete também é devolvido.
      const devolveTudo = [...itensDoPedido.values()].every(
        (item) => (jaDevolvidas.get(item.id_pedido_item) ?? 0) + (escolhidos.get(item.id_pedido_item) ?? 0) >= Number(item.quantidade ?? 1),
      );
      const valor = dinheiro(linhas.reduce((t, l) => t + l.valor, 0) + (devolveTudo ? Number(pedido.valor_frete ?? 0) : 0));

      const nova = await Devolucoes.create(
        { id_pedido: idPedido, id_usuario: comprador.id_usuario, motivo, descricao: descricao || null, valor_reembolso: valor, status: "solicitada" },
        { transaction },
      );
      await DevolucaoItens.bulkCreate(linhas.map((l) => ({ ...l, id_devolucao: nova.id_devolucao })), { transaction });
      return nova;
    });

    const completa = (await buscarComItens(devolucao.id_devolucao))!;
    await avisar(completa, (await Pedidos.findByPk(idPedido))!);
    logger.info("devolucao.solicitada", { devolucao: completa.id_devolucao, pedido: idPedido, motivo });
    return serializar(completa);
  }

  static async minhas(idUsuario: number) {
    const devolucoes = await Devolucoes.findAll({
      where: { id_usuario: idUsuario },
      include: INCLUIR,
      order: [["data_solicitacao", "DESC"]],
    });
    return Promise.all(devolucoes.map((d) => serializar(d)));
  }

  static async cancelar(idDevolucao: number, comprador: Comprador) {
    const devolucao = await buscarComItens(idDevolucao);
    if (!devolucao || devolucao.id_usuario !== comprador.id_usuario) throw new HttpError(404, "Devolução não encontrada.");
    if (devolucao.status !== "solicitada") throw new HttpError(409, "Só dá para cancelar enquanto a devolução está em análise.");

    return DevolucaoService.mudar(devolucao, "cancelada", {});
  }

  // Foto anexada pelo cliente: só enquanto a devolução está em análise, até 3 por devolução.
  static async enviarFoto(idDevolucao: number, comprador: Comprador, corpo: Record<string, unknown>) {
    const devolucao = await buscarComItens(idDevolucao);
    if (!devolucao || devolucao.id_usuario !== comprador.id_usuario) throw new HttpError(404, "Devolução não encontrada.");
    if (devolucao.status !== "solicitada") throw new HttpError(409, "Só dá para anexar fotos enquanto a devolução está em análise.");
    if ((devolucao.fotos ?? []).length >= MAX_FOTOS_POR_DEVOLUCAO) {
      throw new HttpError(409, `Cada devolução aceita até ${MAX_FOTOS_POR_DEVOLUCAO} fotos.`);
    }

    const { bytes, extensao } = lerFotoEnviada(corpo.foto);
    const arquivo = await gravarFoto(bytes, extensao);

    try {
      await DevolucaoFotos.create({ id_devolucao: idDevolucao, arquivo, tipo: extensao, tamanho_bytes: bytes.length });
    } catch (error) {
      await apagarFoto(arquivo);
      throw error;
    }

    logger.info("devolucao.foto_anexada", { devolucao: idDevolucao, bytes: bytes.length });
    return serializar((await buscarComItens(idDevolucao))!);
  }

  // Arquivo da foto: para o dono da devolução ou para quem pode atualizar pedidos (equipe).
  // Para qualquer outra pessoa, 404 (não revela que a foto existe).
  static async lerFoto(idFoto: number, quemPede: AuthUserPayload) {
    const foto = await DevolucaoFotos.findByPk(idFoto);
    const devolucao = foto ? await Devolucoes.findByPk(foto.id_devolucao) : null;
    const ehEquipe = getPermissionsForRole(quemPede.tipo).includes(PERMISSIONS.PEDIDO_ATUALIZAR);

    if (!foto || !devolucao || (devolucao.id_usuario !== quemPede.id_usuario && !ehEquipe)) {
      throw new HttpError(404, "Foto não encontrada.");
    }

    return { caminho: caminhoDaFoto(foto.arquivo), tipo: tipoDoArquivo(foto.arquivo) };
  }

  // ---------------- Equipe da loja ----------------
  static async listar(query: Record<string, unknown>) {
    const status = typeof query.status === "string" && (Object.keys(ROTULO_STATUS) as string[]).includes(query.status) ? (query.status as StatusDevolucao) : undefined;
    const page = Math.max(1, Math.floor(Number(query.page) || 1));
    const limit = Math.min(100, Math.max(1, Math.floor(Number(query.limit) || 20)));
    const { rows, count } = await Devolucoes.findAndCountAll({
      where: status ? { status } : {},
      include: INCLUIR,
      order: [["data_solicitacao", "DESC"]],
      limit,
      offset: (page - 1) * limit,
      distinct: true,
    });

    return {
      data: await Promise.all(rows.map((d) => serializar(d))),
      pagination: { page, limit, total: count, totalPages: Math.max(1, Math.ceil(count / limit)), hasNextPage: page * limit < count, hasPreviousPage: page > 1 },
    };
  }

  static async aprovar(id: number, corpo: Record<string, unknown>) {
    const devolucao = await DevolucaoService.exigir(id, ["solicitada"], "aprovar");
    const instrucoes = texto(corpo.resposta_loja, 1000);
    if (instrucoes.length < 5) throw new HttpError(400, "Explique ao cliente como enviar a peça (resposta_loja).");

    return DevolucaoService.mudar(devolucao, "aprovada", {
      resposta_loja: instrucoes,
      codigo_postagem: texto(corpo.codigo_postagem, 60) || null,
      data_resposta: new Date(),
    });
  }

  static async recusar(id: number, corpo: Record<string, unknown>) {
    const devolucao = await DevolucaoService.exigir(id, ["solicitada", "aprovada"], "recusar");
    const motivo = texto(corpo.resposta_loja, 1000);
    if (motivo.length < 5) throw new HttpError(400, "Explique ao cliente o motivo da recusa (resposta_loja).");

    return DevolucaoService.mudar(devolucao, "recusada", { resposta_loja: motivo, data_resposta: new Date() });
  }

  static async receber(id: number) {
    const devolucao = await DevolucaoService.exigir(id, ["aprovada"], "marcar como recebida");
    return DevolucaoService.mudar(devolucao, "recebida", { data_recebimento: new Date() });
  }

  // Reembolso automático pelo Mercado Pago (estorno no PIX ou no cartão) ou manual (ex.: PIX feito
  // pela loja, informando o comprovante).
  static async reembolsar(id: number, corpo: Record<string, unknown>) {
    const devolucao = await DevolucaoService.exigir(id, ["recebida"], "reembolsar");
    const forma = corpo.forma === "manual" ? "manual" : "mercado_pago";
    const valor = Number(devolucao.valor_reembolso);
    let referencia = texto(corpo.referencia, 120) || null;

    if (forma === "manual" && !referencia) {
      throw new HttpError(400, "Informe a referência do reembolso manual (ex.: id do PIX).");
    }

    if (forma === "mercado_pago") {
      const pagamento = await Pagamentos.findOne({ where: { id_pedido: devolucao.id_pedido, status: "approved" }, order: [["id_pagamento", "DESC"]] });
      if (!pagamento) throw new HttpError(409, "Este pedido não tem pagamento aprovado no Mercado Pago. Use o reembolso manual.");
      if (valor > Number(pagamento.valor) + 0.001) throw new HttpError(409, "O valor da devolução é maior que o pago no Mercado Pago.");

      const reembolso = await criarReembolso(pagamento.mp_payment_id, valor, `devolucao-${devolucao.id_devolucao}`);
      referencia = `MP-${reembolso.id}`;
      logger.info("devolucao.reembolso_mercado_pago", { devolucao: devolucao.id_devolucao, pagamento: pagamento.mp_payment_id, reembolso: reembolso.id, valor });
    }

    return DevolucaoService.mudar(devolucao, "reembolsada", { forma_reembolso: forma, referencia_reembolso: referencia, data_reembolso: new Date() });
  }

  private static async exigir(id: number, permitidos: StatusDevolucao[], acao: string) {
    const devolucao = await buscarComItens(id);
    if (!devolucao) throw new HttpError(404, "Devolução não encontrada.");
    if (!permitidos.includes(devolucao.status)) {
      throw new HttpError(409, `Não dá para ${acao} uma devolução "${ROTULO_STATUS[devolucao.status].toLowerCase()}".`);
    }
    return devolucao;
  }

  private static async mudar(devolucao: Devolucoes, status: StatusDevolucao, campos: Partial<Devolucoes>) {
    // Só muda se ninguém mudou antes (dois cliques ao mesmo tempo no admin).
    const [alteradas] = await Devolucoes.update(
      { ...campos, status },
      { where: { id_devolucao: devolucao.id_devolucao, status: devolucao.status } },
    );
    if (alteradas === 0) throw new HttpError(409, "Esta devolução acabou de ser alterada. Atualize a página.");

    const atualizada = (await buscarComItens(devolucao.id_devolucao))!;
    await avisar(atualizada, (await Pedidos.findByPk(atualizada.id_pedido))!);
    logger.info("devolucao.status", { devolucao: atualizada.id_devolucao, de: devolucao.status, para: status });
    return serializar(atualizada);
  }
}

export default DevolucaoService;
