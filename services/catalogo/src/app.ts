import { criarApp } from "@agnus/comum/utils/servico";
import routes from "./routes";
import interno from "./routes/interno.routes";

export default criarApp({
  rotas: routes,
  interno,
  estaticos: ["produto_fotos"],
  // Produto e foto aceitam imagens em base64 no JSON.
  rotasComCorpoGrande: ["/products", "/product-photos"],
});
