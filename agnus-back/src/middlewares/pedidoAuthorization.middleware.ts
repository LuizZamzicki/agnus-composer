import { NextFunction, Request, Response } from "express";
import Pedidos from "../models/Pedidos";
import type { AuthenticatedResponseLocals } from "./auth.middleware";

type AuthResponse = Response<object, AuthenticatedResponseLocals>;

export const authorizeOrderOwnerOrAdmin = (paramName = "id") =>
  async (req: Request, res: AuthResponse, next: NextFunction) => {
    const authUser = res.locals.authUser;

    if (!authUser) {
      return res.status(401).json({ message: "Nao autenticado." });
    }

    if (authUser.tipo === "administrador") {
      return next();
    }

    const orderId = Number(req.params[paramName]);

    if (!Number.isInteger(orderId)) {
      return next();
    }

    const pedido = await Pedidos.findByPk(orderId);

    if (!pedido) {
      return next();
    }

    if (pedido.get("id_usuario") !== authUser.id_usuario) {
      return res.status(403).json({ message: "Voce so pode acessar o proprio pedido." });
    }

    return next();
  };

export const restrictOrderListToOwner = () =>
  (req: Request, res: AuthResponse, next: NextFunction) => {
    const authUser = res.locals.authUser;

    if (!authUser) {
      return res.status(401).json({ message: "Nao autenticado." });
    }

    if (authUser.tipo === "administrador") {
      return next();
    }

    (req.query as Record<string, unknown>).id_usuario = String(authUser.id_usuario);

    return next();
  };

export const authorizeOwnOrderBody = (bodyField = "id_usuario") =>
  (req: Request, res: AuthResponse, next: NextFunction) => {
    const authUser = res.locals.authUser;

    if (!authUser) {
      return res.status(401).json({ message: "Nao autenticado." });
    }

    if (authUser.tipo === "administrador") {
      return next();
    }

    const bodyUserId = Number((req.body as Record<string, unknown>)[bodyField]);

    if (Number.isInteger(bodyUserId) && bodyUserId !== authUser.id_usuario) {
      return res.status(403).json({ message: "Voce so pode criar pedidos para o proprio usuario." });
    }

    return next();
  };
