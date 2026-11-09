import { criarApp } from "@agnus/comum/utils/servico";
import routes from "./routes";

export default criarApp({ rotas: routes, estaticos: ["avaliacao_fotos"] });
