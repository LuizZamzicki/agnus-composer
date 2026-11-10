import jwt, { JwtPayload } from "jsonwebtoken";
import type { AuthUserPayload } from "../types/auth.types";

export const verificarToken = (token: string): AuthUserPayload | null => {
  const segredo = process.env.JWT_SECRET;

  if (!segredo) {
    throw new Error("JWT_SECRET não configurado.");
  }

  try {
    const decoded = jwt.verify(token, segredo) as JwtPayload & AuthUserPayload;

    return decoded.id_usuario && decoded.email && decoded.tipo
      ? { id_usuario: decoded.id_usuario, email: decoded.email, tipo: decoded.tipo }
      : null;
  } catch {
    return null;
  }
};
