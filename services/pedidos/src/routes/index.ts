import { Router } from "express";
import pagamentos from "../pagamentos/pagamento.routes";
import devolucoes from "./devolucao.routes";
import youdraw from "../fornecedor/youdraw.routes";
import pedidos from "./pedidos.routes";

// Pagamento (Mercado Pago) vem antes: /orders/:id/pagamento não pode cair em outra rota de pedido.
const router = Router();
router.use(pagamentos);
router.use(devolucoes);
router.use(youdraw);
router.use(pedidos);

export default router;
