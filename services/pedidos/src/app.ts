import { criarApp } from "@agnus/comum/utils/servico";
import routes from "./routes";
import interno from "./routes/interno.routes";

// /devolucao-fotos recebe a foto em base64 no JSON: limite de corpo maior só nessa rota.
export default criarApp({ rotas: routes, interno, rotasComCorpoGrande: ["/devolucao-fotos", "/notas-fiscais"] });
