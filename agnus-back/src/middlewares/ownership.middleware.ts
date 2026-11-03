import { NextFunction, Request, Response } from "express";
import AvaliacaoFotos from "../models/AvaliacaoFotos";
import AvaliacaoProdutos from "../models/AvaliacaoProdutos";
import CarrinhoItens from "../models/CarrinhoItens";
import Carrinhos from "../models/Carrinhos";
import Pedidos from "../models/Pedidos";
import UsuarioContatos from "../models/UsuarioContatos";
import UsuarioEnderecos from "../models/UsuarioEnderecos";
import type { PedidoStatus } from "../types/pedido.types";
import type { AuthenticatedResponseLocals } from "./auth.middleware";

type AuthResponse = Response<object, AuthenticatedResponseLocals>;

// Retorna o id do usuario dono do recurso, ou null quando o recurso nao existe.
type OwnerResolver = (id: number) => Promise<number | null>;

const OPEN_ORDER_STATUSES: PedidoStatus[] = ["aguardando_calculo_frete", "aguardando_pagamento"];

const parseId = (value: unknown) => {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const ownerOfCart: OwnerResolver = async (id) =>
  (await Carrinhos.findByPk(id))?.id_usuario ?? null;

const ownerOfReview: OwnerResolver = async (id) =>
  (await AvaliacaoProdutos.findByPk(id))?.id_usuario ?? null;

export const OWNERS = {
  endereco: (async (id) => (await UsuarioEnderecos.findByPk(id))?.id_usuario ?? null) as OwnerResolver,
  contato: (async (id) => (await UsuarioContatos.findByPk(id))?.id_usuario ?? null) as OwnerResolver,
  avaliacao: ownerOfReview,
  avaliacaoFoto: (async (id) => {
    const foto = await AvaliacaoFotos.findByPk(id);
    return foto ? ownerOfReview(foto.id_avaliacao_produto) : null;
  }) as OwnerResolver,
  carrinho: ownerOfCart,
  carrinhoItem: (async (id) => {
    const item = await CarrinhoItens.findByPk(id);
    return item ? ownerOfCart(item.id_carrinho) : null;
  }) as OwnerResolver,
  pedido: (async (id) => (await Pedidos.findByPk(id))?.id_usuario ?? null) as OwnerResolver,
};

const isAdmin = (res: AuthResponse) => res.locals.authUser?.tipo === "administrador";

const denyUnauthenticated = (res: AuthResponse) =>
  res.status(401).json({ message: "Nao autenticado." });

const denyForeign = (res: AuthResponse) =>
  res.status(403).json({ message: "Voce so pode acessar os proprios dados." });

/**
 * Verifica o dono do recurso apontado por um parametro de rota.
 * Recurso inexistente segue para o controller, que responde 404.
 */
export const authorizeOwnerByParam = (paramName: string, resolveOwner: OwnerResolver) =>
  async (req: Request, res: AuthResponse, next: NextFunction) => {
    const authUser = res.locals.authUser;

    if (!authUser) {
      return denyUnauthenticated(res);
    }

    const id = parseId(req.params[paramName]);

    if (isAdmin(res) || !id) {
      return next();
    }

    const ownerId = await resolveOwner(id);

    return ownerId !== null && ownerId !== authUser.id_usuario ? denyForeign(res) : next();
  };

/**
 * Para campos do corpo que apontam para o dono (ex.: id_usuario) ou para um recurso pai
 * (ex.: id_carrinho). Sem resolver, o campo deve ser o proprio usuario; quando ausente
 * numa criacao, e preenchido com o usuario do token.
 */
export const authorizeOwnerByBody = (fieldName: string, resolveOwner?: OwnerResolver) =>
  async (req: Request, res: AuthResponse, next: NextFunction) => {
    const authUser = res.locals.authUser;

    if (!authUser) {
      return denyUnauthenticated(res);
    }

    if (isAdmin(res)) {
      return next();
    }

    const body = (req.body ?? {}) as Record<string, unknown>;

    if (body[fieldName] === undefined || body[fieldName] === null || body[fieldName] === "") {
      if (!resolveOwner && req.method === "POST") {
        req.body = { ...body, [fieldName]: authUser.id_usuario };
      }

      return next();
    }

    const id = parseId(body[fieldName]);

    if (!id) {
      return next();
    }

    const ownerId = resolveOwner ? await resolveOwner(id) : id;

    return ownerId !== null && ownerId !== authUser.id_usuario ? denyForeign(res) : next();
  };

/** Listagens filtradas por usuario: o cliente precisa filtrar pelo proprio id. */
export const authorizeOwnerByQuery = (fieldName: string) =>
  (req: Request, res: AuthResponse, next: NextFunction) => {
    const authUser = res.locals.authUser;

    if (!authUser) {
      return denyUnauthenticated(res);
    }

    if (isAdmin(res)) {
      return next();
    }

    return parseId(req.query[fieldName]) === authUser.id_usuario ? next() : denyForeign(res);
  };

/** Cliente so adiciona itens ao proprio pedido enquanto ele ainda nao foi pago. */
export const authorizeOpenOrderBody = (fieldName = "id_pedido") =>
  async (req: Request, res: AuthResponse, next: NextFunction) => {
    const authUser = res.locals.authUser;

    if (!authUser) {
      return denyUnauthenticated(res);
    }

    if (isAdmin(res)) {
      return next();
    }

    const id = parseId((req.body as Record<string, unknown> | undefined)?.[fieldName]);
    const pedido = id ? await Pedidos.findByPk(id) : null;

    if (!pedido) {
      return next();
    }

    if (pedido.id_usuario !== authUser.id_usuario) {
      return denyForeign(res);
    }

    return OPEN_ORDER_STATUSES.includes(pedido.status)
      ? next()
      : res.status(409).json({ message: "Itens so podem ser adicionados a pedidos ainda nao pagos." });
  };
