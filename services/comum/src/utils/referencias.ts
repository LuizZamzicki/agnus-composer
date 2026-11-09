import { buscarUsuario } from "../middlewares/auth.middleware";

export const usuarioExiste = async (idUsuario: number) => Boolean(await buscarUsuario(idUsuario));
