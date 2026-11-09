import { Request, Response } from "express";
import type { AuthenticatedResponseLocals } from "../middlewares/auth.middleware";
import Notificacoes from "../models/Notificacoes";

type NotificacaoResponse = Response<object, AuthenticatedResponseLocals>;

const LIMITE_DA_LISTA = 30;

// O usuario sempre vem do token: ninguem le nem marca a notificacao de outra pessoa.
// A lista traz so as nao lidas: a notificacao aberta deixa de aparecer.
class NotificacoesController {
  static async findMine(_req: Request, res: NotificacaoResponse) {
    const id_usuario = res.locals.authUser!.id_usuario;
    const [data, naoLidas] = await Promise.all([
      Notificacoes.findAll({
        where: { id_usuario, lida: false },
        order: [["id_notificacao", "DESC"]],
        limit: LIMITE_DA_LISTA,
      }),
      Notificacoes.count({ where: { id_usuario, lida: false } }),
    ]);

    return res.status(200).json({ data, naoLidas });
  }

  static async markAsRead(req: Request, res: NotificacaoResponse) {
    const id_notificacao = Number(req.params.id);

    if (!Number.isInteger(id_notificacao) || id_notificacao <= 0) {
      return res.status(400).json({ message: "ID da notificação inválido." });
    }

    const [alteradas] = await Notificacoes.update(
      { lida: true },
      { where: { id_notificacao, id_usuario: res.locals.authUser!.id_usuario } },
    );

    return alteradas || (await Notificacoes.count({ where: { id_notificacao, id_usuario: res.locals.authUser!.id_usuario } }))
      ? res.status(204).send()
      : res.status(404).json({ message: "Notificação não encontrada." });
  }

  static async markAllAsRead(_req: Request, res: NotificacaoResponse) {
    await Notificacoes.update(
      { lida: true },
      { where: { id_usuario: res.locals.authUser!.id_usuario, lida: false } },
    );

    return res.status(204).send();
  }
}

export default NotificacoesController;
