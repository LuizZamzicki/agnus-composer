import { definirBuscaDeUsuario } from "@agnus/comum/middlewares/auth.middleware";
import { criarApp } from "@agnus/comum/utils/servico";
import Usuarios from "./models/Usuarios";
import routes from "./routes";
import interno from "./routes/interno.routes";

definirBuscaDeUsuario(async (id_usuario) => {
  const usuario = await Usuarios.findByPk(id_usuario);
  return usuario ? { id_usuario: usuario.id_usuario, email: usuario.email, tipo: usuario.tipo } : null;
});

export default criarApp({ rotas: routes, interno });
