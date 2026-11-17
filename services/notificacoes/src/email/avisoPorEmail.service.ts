import { chamarServico } from "@agnus/comum/utils/clienteInterno";
import logger from "@agnus/comum/utils/logger";
import EmailService from "./email.service";
import {
  emailDeDevolucao,
  emailDeStatus,
  emailDevolucaoParaEquipe,
  emailNovoPedidoParaEquipe,
  emailPagamentoParaEquipe,
  emailBoasVindasOfertas,
  emailPedirAvaliacao,
  type ProdutoParaAvaliar,
  type AvisoDevolucao,
  type PedidoStatus,
} from "./modelos";

type UsuarioInterno = { id_usuario: number; nome?: string | null; email?: string | null };

// EMAIL_EQUIPE aceita vários endereços separados por vírgula; vazio = equipe não recebe e-mail.
const emailsDaEquipe = () =>
  (process.env.EMAIL_EQUIPE ?? "")
    .split(",")
    .map((email) => email.trim())
    .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));

const buscarUsuario = async (idUsuario: number) => {
  try {
    const { data } = await chamarServico<UsuarioInterno>("identidade", `/usuarios/${idUsuario}`, {
      timeoutMs: 5000,
      repetivel: true,
    });

    return data?.email ? data : null;
  } catch (error) {
    logger.warn("email.usuario_indisponivel", {
      usuario: idUsuario,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

class AvisoPorEmailService {
  static async statusDoPedido(pedido: { id_usuario: number; id_pedido: number; status: PedidoStatus; valor_total?: number | null }) {
    const usuario = await buscarUsuario(pedido.id_usuario);
    const email = usuario && emailDeStatus({ nome: usuario.nome, email: usuario.email! }, pedido.id_pedido, pedido.status, pedido.valor_total);

    const contexto = { id_pedido: pedido.id_pedido, id_usuario: pedido.id_usuario };

    if (email) {
      await EmailService.enviar(email, { ...contexto, destinatario: "cliente" });
    }

    if (pedido.status === "pago") {
      await Promise.all(
        emailsDaEquipe().map((para) => EmailService.enviar(emailPagamentoParaEquipe(para, pedido.id_pedido), { ...contexto, destinatario: "equipe" })),
      );
    }
  }

  static async pedidoCriado(pedido: { id_usuario: number; id_pedido: number; status: PedidoStatus; valor_total: number | null }) {
    await AvisoPorEmailService.statusDoPedido(pedido);
    await Promise.all(
      emailsDaEquipe().map((para) =>
        EmailService.enviar(emailNovoPedidoParaEquipe(para, pedido.id_pedido, pedido.valor_total), {
          id_pedido: pedido.id_pedido,
          id_usuario: pedido.id_usuario,
          destinatario: "equipe",
        }),
      ),
    );
  }
}

// Disparo sem esperar: o SMTP pode levar segundos e quem avisou (pedidos) não deve ficar preso nisso.
export const avisarDevolucaoPorEmail = async (aviso: AvisoDevolucao & { id_usuario: number }) => {
  const usuario = await buscarUsuario(aviso.id_usuario);
  const email = usuario && emailDeDevolucao({ nome: usuario.nome, email: usuario.email! }, aviso);
  const contexto = { id_pedido: aviso.id_pedido, id_usuario: aviso.id_usuario, id_devolucao: aviso.id_devolucao };
  if (email) await EmailService.enviar(email, { ...contexto, destinatario: "cliente" });

  // A equipe precisa saber de cada pedido novo de devolução para responder.
  if (aviso.status === "solicitada") {
    await Promise.all(emailsDaEquipe().map((para) => EmailService.enviar(emailDevolucaoParaEquipe(para, aviso), { ...contexto, destinatario: "equipe" })));
  }
};

export const enviarBoasVindasOfertas = (aviso: { email: string; cupom: string; token: string; percentual: number }) =>
  EmailService.enviar(emailBoasVindasOfertas(aviso.email, aviso.cupom, aviso.token, aviso.percentual), { destinatario: "cliente" });

export const pedirAvaliacaoPorEmail = async (pedido: { id_usuario: number; id_pedido: number; produtos: ProdutoParaAvaliar[] }) => {
  const usuario = await buscarUsuario(pedido.id_usuario);
  const email = usuario && emailPedirAvaliacao({ nome: usuario.nome, email: usuario.email! }, pedido.id_pedido, pedido.produtos);
  if (email) await EmailService.enviar(email, { id_pedido: pedido.id_pedido, id_usuario: pedido.id_usuario, destinatario: "cliente" });
};

export const dispararSemEsperar = (tarefa: Promise<unknown>, contexto: Record<string, unknown>) => {
  tarefa.catch((error) =>
    logger.error("email.falha_inesperada", { ...contexto, error: error instanceof Error ? error.message : String(error) }),
  );
};

export default AvisoPorEmailService;
