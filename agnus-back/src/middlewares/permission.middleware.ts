import { NextFunction, Request, Response } from "express";
import { getPermissionsForRole, type Permission } from "../config/permissions";
import type { AuthenticatedResponseLocals } from "./auth.middleware";

type AuthResponse = Response<object, AuthenticatedResponseLocals>;

export const checarPermissao = (permissaoNecessaria: Permission) =>
  (req: Request, res: AuthResponse, next: NextFunction) => {
    const authUser = res.locals.authUser;

    if (!authUser) {
      return res.status(401).json({ message: "Nao autenticado." });
    }

    const permissoesDoUsuario = getPermissionsForRole(authUser.tipo);

    if (!permissoesDoUsuario.includes(permissaoNecessaria)) {
      return res.status(403).json({
        message: `Acesso negado: permissao "${permissaoNecessaria}" e necessaria.`,
      });
    }

    return next();
  };
