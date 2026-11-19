import { Request, Response, Router } from "express";
import NotificacaoService from "../services/notificacao.service";
import Notificacoes from "../models/Notificacoes";
import {
  dispararSemEsperar,
  enviarBoasVindasOfertas,
  notaFiscalPorEmail,
  pedirAvaliacaoPorEmail,
  sacolaEsquecidaPorEmail,
} from "../email/avisoPorEmail.service";

const router = Router();

router.post("/status-pedido", async (req: Request, res: Response) => {
  await NotificacaoService.avisarMudancaDeStatus(req.body);
  return res.status(204).send();
});

router.post("/devolucao", async (req: Request, res: Response) => {
  const corpo = req.body ?? {};

  if (!Number.isInteger(corpo.id_usuario) || !Number.isInteger(corpo.id_pedido) || typeof corpo.status !== "string") {
    return res.status(400).json({ message: "Aviso de devolução incompleto." });
  }

  await NotificacaoService.avisarDevolucao(corpo);
  return res.status(204).send();
});

// Inscrição nas ofertas (pedidos): e-mail de boas-vindas com o cupom e o link para cancelar.
router.post("/ofertas/boas-vindas", (req: Request, res: Response) => {
  const corpo = req.body ?? {};

  if (typeof corpo.email !== "string" || typeof corpo.cupom !== "string" || typeof corpo.token !== "string") {
    return res.status(400).json({ message: "Inscrição incompleta." });
  }

  dispararSemEsperar(
    enviarBoasVindasOfertas({ email: corpo.email, cupom: corpo.cupom, token: corpo.token, percentual: Number(corpo.percentual) || 10 }),
    { aviso: "ofertas.boas_vindas" },
  );
  return res.status(202).send();
});

// Alguns dias depois da entrega (pedidos): aviso no site e e-mail pedindo a avaliação das peças.
router.post("/pedir-avaliacao", async (req: Request, res: Response) => {
  const corpo = req.body ?? {};
  const produtos = Array.isArray(corpo.produtos)
    ? corpo.produtos
        .filter((p: { id_produto?: unknown; nome?: unknown }) => Number.isInteger(p?.id_produto) && typeof p?.nome === "string")
        .slice(0, 20)
    : [];

  if (!Number.isInteger(corpo.id_usuario) || !Number.isInteger(corpo.id_pedido) || !produtos.length) {
    return res.status(400).json({ message: "Pedido de avaliação incompleto." });
  }

  await Notificacoes.create({
    id_usuario: corpo.id_usuario,
    id_pedido: corpo.id_pedido,
    titulo: "Avalie suas peças",
    mensagem: `Como ficou o pedido #${corpo.id_pedido}? Sua avaliação ajuda quem está escolhendo.`,
  });
  dispararSemEsperar(pedirAvaliacaoPorEmail({ id_usuario: corpo.id_usuario, id_pedido: corpo.id_pedido, produtos }), {
    pedido: corpo.id_pedido,
  });
  return res.status(204).send();
});

// A loja anexou a NF-e do pedido: aviso no site e por e-mail.
router.post("/nota-fiscal", async (req: Request, res: Response) => {
  const corpo = req.body ?? {};
  if (!Number.isInteger(corpo.id_usuario) || !Number.isInteger(corpo.id_pedido)) {
    return res.status(400).json({ message: "Aviso de nota fiscal incompleto." });
  }

  await Notificacoes.create({
    id_usuario: corpo.id_usuario,
    id_pedido: corpo.id_pedido,
    titulo: "Nota fiscal disponível",
    mensagem: `A NF-e do pedido #${corpo.id_pedido} já está em Meus pedidos.`,
  });
  dispararSemEsperar(notaFiscalPorEmail({ id_usuario: corpo.id_usuario, id_pedido: corpo.id_pedido }), { pedido: corpo.id_pedido });
  return res.status(204).send();
});

// Sacola esquecida (carrinho): só e-mail, com as peças e o link para não receber mais.
router.post("/sacola-esquecida", (req: Request, res: Response) => {
  const corpo = req.body ?? {};
  const pecas = Array.isArray(corpo.pecas)
    ? corpo.pecas
        .filter((p: { id_produto?: unknown; nome?: unknown; preco?: unknown }) =>
          Number.isInteger(p?.id_produto) && typeof p?.nome === "string" && Number.isFinite(Number(p?.preco)))
        .slice(0, 6)
    : [];

  if (!Number.isInteger(corpo.id_usuario) || ![1, 2].includes(corpo.etapa) || typeof corpo.token !== "string" || !pecas.length) {
    return res.status(400).json({ message: "Lembrete de sacola incompleto." });
  }

  dispararSemEsperar(sacolaEsquecidaPorEmail({ id_usuario: corpo.id_usuario, etapa: corpo.etapa, token: corpo.token, pecas }), {
    aviso: "sacola.esquecida",
    id_usuario: corpo.id_usuario,
  });
  return res.status(202).send();
});

export default router;
