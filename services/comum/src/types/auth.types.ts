import type { UsuarioModelData, UsuarioPublicData } from "./user.types";

export type AuthUserPayload = Pick<UsuarioModelData, "id_usuario" | "email" | "tipo"> & {
  // Marca da credencial (ver marcaDeSessao): só circula entre token e identidade, nunca vai em resposta.
  sessao?: string;
};

export type AuthResult = {
  user: UsuarioPublicData;
  token: string;
};
