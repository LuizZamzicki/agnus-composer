import type { OwnerResolver } from "@agnus/comum/middlewares/ownership.middleware";
import UsuarioContatos from "../models/UsuarioContatos";
import UsuarioEnderecos from "../models/UsuarioEnderecos";

export const OWNERS = {
  endereco: (async (id) => (await UsuarioEnderecos.findByPk(id))?.id_usuario ?? null) as OwnerResolver,
  contato: (async (id) => (await UsuarioContatos.findByPk(id))?.id_usuario ?? null) as OwnerResolver,
};
