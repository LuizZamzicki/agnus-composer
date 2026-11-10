import { criarApp } from "@agnus/comum/utils/servico";
import routes from "./routes/admin.routes";

export default criarApp({ rotas: routes, metricasLocais: false });
