import { criarApp } from "@agnus/comum/utils/servico";
import routes from "./routes";
import interno from "./routes/interno.routes";

export default criarApp({ rotas: routes, interno, estaticos: ["produto_fotos"] });
