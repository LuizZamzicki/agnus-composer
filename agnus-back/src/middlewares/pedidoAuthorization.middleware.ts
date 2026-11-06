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
