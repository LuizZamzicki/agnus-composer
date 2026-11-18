import { randomUUID } from "crypto";
import { DataTypes, Model, Op } from "sequelize";
import sequelize from "@agnus/comum/config/database";
import EventBusService from "@agnus/comum/services/eventBus.service";
import { HttpError } from "@agnus/comum/types/http_error";
import { chamarServico } from "@agnus/comum/utils/clienteInterno";
import logger from "@agnus/comum/utils/logger";
import {
  buscarPedidoYouDraw,
  configuracaoYouDraw,
  criarPedidoYouDraw,
  ErroYouDraw,
  type EventoWebhookYouDraw,
  type NovoPedidoYouDraw,
  type PedidoYouDraw,
} from "@agnus/comum/utils/youdraw";
import PedidoItens from "../models/PedidoItens";
import Pedidos from "../models/Pedidos";
import AvisoPedidoService from "../services/avisoPedido.service";
import type { PedidoStatus } from "../types/pedido.types";

export type SituacaoFornecedor = "aguardando" | "enviado" | "erro" | "manual";

export class PedidosFornecedor extends Model {
  declare id_pedido: number;
  declare fornecedor: string;
  declare situacao: SituacaoFornecedor;
  declare chave_idempotencia: string;
  declare id_externo: string | null;
  declare codigo_publico: string | null;
  declare status_externo: string | null;
  declare total_centavos: number | null;
  declare frete_centavos: number | null;
  declare rastreio_codigo: string | null;
  declare rastreio_url: string | null;
  declare erro_codigo: string | null;
  declare erro: string | null;
  declare retentavel: boolean;
  declare tentativas: number;
  declare data_envio: Date | null;
  declare data_alteracao: Date;
}

PedidosFornecedor.init(
  {
    id_pedido: { type: DataTypes.INTEGER, primaryKey: true },
    fornecedor: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "youdraw" },
    situacao: { type: DataTypes.ENUM("aguardando", "enviado", "erro", "manual"), allowNull: false, defaultValue: "aguardando" },
    chave_idempotencia: { type: DataTypes.CHAR(36), allowNull: false },
    id_externo: { type: DataTypes.STRING(64), allowNull: true },
    codigo_publico: { type: DataTypes.STRING(32), allowNull: true },
    status_externo: { type: DataTypes.STRING(30), allowNull: true },
    total_centavos: { type: DataTypes.INTEGER, allowNull: true },
    frete_centavos: { type: DataTypes.INTEGER, allowNull: true },
    rastreio_codigo: { type: DataTypes.STRING(64), allowNull: true },
    rastreio_url: { type: DataTypes.STRING(500), allowNull: true },
    erro_codigo: { type: DataTypes.STRING(60), allowNull: true },
    erro: { type: DataTypes.STRING(255), allowNull: true },
    retentavel: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    tentativas: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    data_envio: { type: DataTypes.DATE, allowNull: true },
    data_alteracao: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { sequelize, tableName: "pedidos_fornecedor", timestamps: false },
);

// Erro de montagem do pedido (dado faltando na loja): não adianta repetir sem alguém corrigir.
export class ErroDeDados extends Error {
  constructor(readonly codigo: string, message: string) {
    super(message);
  }
}

type DadosEntrega = {
  nome: string;
  cpf: string | null;
  email: string | null;
  telefone: string | null;
  endereco: { cep: string; logradouro: string; numero: string | null; complemento: string | null; bairro: string | null; cidade: string | null; estado: string | null };
};

type SkuResolvido = { id_produto_cor: number; id_produto_grade: number; id_produto: number | null; cor: string | null; tamanho: string | null; sku: string | null };

const MAX_TENTATIVAS = 8;
const STATUS_FINAIS = new Set(["delivered", "canceled", "returned"]);
const referencia = (idPedido: number) => `agnus-${idPedido}`;
const idDaReferencia = (ref: string | null | undefined) => {
  const m = /^agnus-(\d+)$/.exec(ref ?? "");
  return m ? Number(m[1]) : null;
};
const digitos = (valor: string | null | undefined) => (valor ?? "").replace(/\D/g, "");

const telefoneInternacional = (valor: string | null) => {
  const d = digitos(valor);
  if (d.length === 10 || d.length === 11) return `+55${d}`;
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return `+${d}`;
  return null;
};

// Monta o corpo de POST /orders com os dados do pedido, do cliente e os SKUs das peças.
export const montarPedidoYouDraw = async (pedido: Pedidos): Promise<NovoPedidoYouDraw> => {
  const { data: entrega } = await chamarServico<DadosEntrega>("identidade", `/entrega/${pedido.id_usuario_endereco}`, { repetivel: true, timeoutMs: 5000 });
  const itens = await PedidoItens.findAll({ where: { id_pedido: pedido.id_pedido } });
  if (itens.length === 0) throw new ErroDeDados("pedido_sem_itens", "O pedido não tem itens.");

  const { data: skus } = await chamarServico<SkuResolvido[]>("catalogo", "/variantes/skus", {
    method: "POST",
    body: { pares: itens.map((i) => ({ id_produto_cor: i.id_produto_cor, id_produto_grade: i.id_produto_grade })) },
    timeoutMs: 5000,
  });

  const faltando = skus.filter((s) => !s.sku);
  if (faltando.length) {
    const lista = faltando.map((s) => (s.cor ? `${s.cor} / ${s.tamanho} (produto ${s.id_produto})` : `variante ${s.id_produto_cor}/${s.id_produto_grade} não existe mais`)).join("; ");
    throw new ErroDeDados("sku_ausente", `Sem SKU da YouDraw: ${lista}`.slice(0, 255));
  }

  // A YouDraw recusa o mesmo SKU repetido: soma as quantidades.
  const quantidades = new Map<string, number>();
  itens.forEach((item, i) => quantidades.set(skus[i].sku!, (quantidades.get(skus[i].sku!) ?? 0) + Number(item.quantidade ?? 1)));

  const cpf = digitos(entrega.cpf);
  const cep = digitos(entrega.endereco.cep);
  const e = entrega.endereco;
  const faltas = [
    !entrega.nome && "nome",
    !(cpf.length === 11 || cpf.length === 14) && "CPF",
    cep.length !== 8 && "CEP",
    !e.logradouro && "rua",
    !e.numero && "número",
    !e.bairro && "bairro",
    !e.cidade && "cidade",
    !e.estado && "estado",
  ].filter(Boolean);
  if (faltas.length) throw new ErroDeDados("dados_incompletos", `Dados do cliente incompletos para a YouDraw: ${faltas.join(", ")}.`);

  return {
    external_reference: referencia(pedido.id_pedido),
    customer: {
      name: entrega.nome.slice(0, 255),
      document: cpf,
      email: entrega.email,
      phone: telefoneInternacional(entrega.telefone),
      address: {
        postal_code: cep,
        street: e.logradouro.slice(0, 255),
        number: String(e.numero).slice(0, 20),
        complement: e.complemento ? e.complemento.slice(0, 255) : null,
        neighborhood: String(e.bairro).slice(0, 255),
        city: String(e.cidade).slice(0, 255),
        state: String(e.estado).slice(0, 60),
      },
    },
    items: [...quantidades].map(([sku, quantity]) => ({ sku, quantity: Math.min(999, quantity) })),
    notes: `Pedido #${pedido.id_pedido} da loja Agnus.`,
  };
};

// Muda o status do pedido na loja como a equipe faria (aviso ao cliente + evento pedido.atualizado).
const mudarStatus = async (pedido: Pedidos, novo: PedidoStatus) => {
  const anterior = pedido.status;
  if (anterior === novo) return;
  await pedido.update({ status: novo, ...(novo === "entregue" && !pedido.data_entrega ? { data_entrega: new Date() } : {}) });
  await AvisoPedidoService.avisarMudancaDeStatus(pedido, anterior);
  await EventBusService.publish("pedido.atualizado", { id_pedido: pedido.id_pedido, id_usuario: pedido.id_usuario, status_anterior: anterior, status: novo });
};

const publicarStatus = (registro: PedidosFornecedor, idUsuario: number | null, extra: Record<string, string | number | null> = {}) =>
  EventBusService.publish("fornecedor.status", {
    id_pedido: registro.id_pedido,
    id_usuario: idUsuario,
    fornecedor: "youdraw",
    codigo_publico: registro.codigo_publico,
    status_externo: registro.status_externo,
    ...extra,
  });

class YouDrawService {
  static ativa() {
    return Boolean(configuracaoYouDraw());
  }

  static async registroDe(idPedido: number) {
    const [registro] = await PedidosFornecedor.findOrCreate({
      where: { id_pedido: idPedido },
      defaults: { id_pedido: idPedido, chave_idempotencia: randomUUID(), situacao: "aguardando" },
    });
    return registro;
  }

  // Cria o pedido na YouDraw (chamado quando o pedido fica pago, pela rotina e pelo admin).
  // Idempotente: a mesma chave é reusada; pedido já enviado não é enviado de novo.
  static async enviar(idPedido: number, { novaChave = false } = {}) {
    const pedido = await Pedidos.findByPk(idPedido);
    if (!pedido) throw new HttpError(404, "Pedido não encontrado.");
    if (!["pago", "enviado", "entregue"].includes(pedido.status)) {
      throw new HttpError(409, "Só pedidos pagos vão para a YouDraw.");
    }

    const registro = await YouDrawService.registroDe(idPedido);
    if (registro.situacao === "enviado") return registro;

    if (!configuracaoYouDraw()) {
      await registro.update({ situacao: "manual", erro_codigo: "integracao_desligada", erro: "Integração desligada (YOUDRAW_API_KEY vazia): crie o pedido no painel da YouDraw.", retentavel: false });
      await EventBusService.publish("fornecedor.pedido_falhou", { id_pedido: idPedido, id_usuario: pedido.id_usuario, codigo: "integracao_desligada", retentavel: false });
      return registro;
    }

    // Só com confirmação da equipe: uma chave nova pode criar um segundo pedido lá se o primeiro existir.
    if (novaChave) await registro.update({ chave_idempotencia: randomUUID() });

    try {
      const corpo = await montarPedidoYouDraw(pedido);
      const criado = await criarPedidoYouDraw(corpo, registro.chave_idempotencia);
      await YouDrawService.gravarPedidoYouDraw(registro, criado, { envio: true });
      await EventBusService.publish("fornecedor.pedido_criado", {
        id_pedido: idPedido,
        id_usuario: pedido.id_usuario,
        codigo_publico: criado.public_code,
        status_externo: criado.status,
        total_centavos: criado.amounts?.total_cents ?? null,
      });
      logger.info("youdraw.pedido_criado", { pedido: idPedido, youdraw: criado.public_code, status: criado.status });
      return registro;
    } catch (error) {
      const deDados = error instanceof ErroDeDados;
      const daYouDraw = error instanceof ErroYouDraw;
      const retentavel = daYouDraw ? error.retentavel : !deDados; // falha de rede/serviço interno: tenta de novo
      const codigo = deDados || daYouDraw ? error.codigo : "falha_interna";
      const mensagem = (error instanceof Error ? error.message : String(error)).slice(0, 255);

      // Nada foi criado lá (erro de dado nosso ou recusa de validação): a próxima tentativa, com o
      // dado corrigido, usa chave nova. Sem resposta ou 5xx o pedido PODE existir: mantém a chave.
      const nadaCriado = deDados || (daYouDraw && [400, 422].includes(error.status));

      await registro.update({
        situacao: "erro",
        erro_codigo: codigo,
        erro: mensagem,
        retentavel: retentavel && registro.tentativas + 1 < MAX_TENTATIVAS,
        tentativas: registro.tentativas + 1,
        ...(nadaCriado ? { chave_idempotencia: randomUUID() } : {}),
      });
      await EventBusService.publish("fornecedor.pedido_falhou", { id_pedido: idPedido, id_usuario: pedido.id_usuario, codigo, mensagem, retentavel });
      logger.warn("youdraw.envio_falhou", { pedido: idPedido, codigo, retentavel, tentativa: registro.tentativas });
      return registro;
    }
  }

  // Disparo quando o pedido fica pago: não segura quem mudou o status (pagamento/admin).
  static aoPagar(pedido: Pick<Pedidos, "id_pedido" | "status">) {
    if (pedido.status !== "pago") return;
    YouDrawService.enviar(pedido.id_pedido).catch((error) =>
      logger.error("youdraw.disparo_falhou", { pedido: pedido.id_pedido, error: error instanceof Error ? error.message : String(error) }),
    );
  }

  // Atualiza o que sabemos do pedido lá e reflete na loja: enviado/entregue mudam o pedido daqui.
  static async gravarPedidoYouDraw(registro: PedidosFornecedor, pyd: PedidoYouDraw, { envio = false } = {}) {
    const envioAtual = pyd.shipments?.[pyd.shipments.length - 1];
    const statusAnterior = registro.status_externo;

    await registro.update({
      situacao: "enviado",
      id_externo: pyd.id,
      codigo_publico: pyd.public_code,
      status_externo: pyd.status,
      total_centavos: pyd.amounts?.total_cents ?? registro.total_centavos,
      frete_centavos: pyd.amounts?.shipping_cents ?? registro.frete_centavos,
      rastreio_codigo: envioAtual?.tracking_code ?? registro.rastreio_codigo,
      rastreio_url: envioAtual?.tracking_url ?? registro.rastreio_url,
      erro_codigo: null,
      erro: null,
      retentavel: false,
      ...(envio ? { data_envio: new Date() } : {}),
    });

    const pedido = await Pedidos.findByPk(registro.id_pedido);
    if (!pedido) return;

    // O código público (YD-...) é o que a página de rastreio da YouDraw encontra.
    if (!pedido.codigo_rastreio && pyd.public_code) {
      await pedido.update({ codigo_rastreio: pyd.public_code.slice(0, 36) });
    }

    if (!envio && statusAnterior !== pyd.status) {
      await publicarStatus(registro, pedido.id_usuario, { status_anterior: statusAnterior });
    }

    // Só avança (nunca volta) e respeita o fluxo pago -> enviado -> entregue.
    if ((pyd.status === "shipped" || pyd.status === "delivered") && pedido.status === "pago") await mudarStatus(pedido, "enviado");
    if (pyd.status === "delivered" && pedido.status === "enviado") await mudarStatus(pedido, "entregue");
  }

  // Webhook (order.created, order.status_changed, order.tracking_updated, payment.*).
  static async aplicarEvento(evento: EventoWebhookYouDraw) {
    const pyd = evento.data?.order;
    if (!pyd) return { aplicado: false, motivo: "sem pedido no evento" };

    const idPedido = idDaReferencia(pyd.external_reference);
    const registro =
      (pyd.id ? await PedidosFornecedor.findOne({ where: { id_externo: pyd.id } }) : null) ??
      (idPedido ? await PedidosFornecedor.findByPk(idPedido) : null);
    if (!registro) return { aplicado: false, motivo: "pedido não é desta loja" };

    if (evento.type === "order.tracking_updated" && evento.data.tracking) {
      pyd.shipments = [...(pyd.shipments ?? []), evento.data.tracking];
    }
    await YouDrawService.gravarPedidoYouDraw(registro, pyd);
    return { aplicado: true, id_pedido: registro.id_pedido };
  }

  // Rotina (a cada 10 min): tenta de novo os envios que falharam por motivo passageiro e atualiza o
  // status dos pedidos que já estão lá. NUNCA pega pedido pago antigo que a integração não começou:
  // ligar a chave não pode criar pedidos reais na YouDraw para vendas antigas (esses, só pelo admin).
  static async sincronizar() {
    if (!configuracaoYouDraw()) return { enviados: 0, atualizados: 0 };

    const retentaveis = await PedidosFornecedor.findAll({
      where: { [Op.or]: [{ situacao: "aguardando" }, { situacao: "erro", retentavel: true }] },
      order: [["data_alteracao", "ASC"]],
      limit: 20,
    });
    const fila = retentaveis.map((r) => r.id_pedido);

    let enviados = 0;
    for (const id of fila) {
      const r = await YouDrawService.enviar(id).catch(() => null);
      if (r?.situacao === "enviado") enviados += 1;
    }

    // Reconciliação recomendada pela YouDraw: o webhook pode não chegar (ex.: sem URL pública).
    const abertos = await PedidosFornecedor.findAll({ where: { situacao: "enviado", status_externo: { [Op.notIn]: [...STATUS_FINAIS] } }, limit: 50 });
    let atualizados = 0;
    for (const registro of abertos) {
      try {
        const pyd = await buscarPedidoYouDraw(registro.id_externo ?? registro.codigo_publico ?? "");
        if (pyd.status !== registro.status_externo || (pyd.shipments?.length ?? 0) > 0) {
          await YouDrawService.gravarPedidoYouDraw(registro, pyd);
          atualizados += 1;
        }
      } catch (error) {
        logger.warn("youdraw.consulta_falhou", { pedido: registro.id_pedido, error: error instanceof Error ? error.message : String(error) });
      }
    }

    return { enviados, atualizados };
  }

  static resumo(registro: PedidosFornecedor | null | undefined) {
    if (!registro) return null;
    return {
      fornecedor: registro.fornecedor,
      situacao: registro.situacao,
      codigo_publico: registro.codigo_publico,
      status_externo: registro.status_externo,
      total: registro.total_centavos == null ? null : registro.total_centavos / 100,
      frete: registro.frete_centavos == null ? null : registro.frete_centavos / 100,
      rastreio_codigo: registro.rastreio_codigo,
      rastreio_url: registro.rastreio_url,
      erro: registro.erro,
      erro_codigo: registro.erro_codigo,
      retentavel: registro.retentavel,
      tentativas: registro.tentativas,
      data_envio: registro.data_envio,
    };
  }
}

export const iniciarSincronizacaoYouDraw = () => {
  const rodar = () =>
    YouDrawService.sincronizar()
      .then((r) => (r.enviados || r.atualizados) && logger.info("youdraw.sincronizado", r))
      .catch((error) => logger.warn("youdraw.sincronizacao_falhou", { error: error instanceof Error ? error.message : String(error) }));
  setTimeout(rodar, 60_000).unref();
  setInterval(rodar, 10 * 60_000).unref();
};

export default YouDrawService;
