import { Router } from "express";
import authenticateToken from "@agnus/comum/middlewares/auth.middleware";
import SacolaController from "../controllers/sacola.controller";
import VitrineController from "../controllers/vitrine.controller";

// Bounded context Loja: vitrine e sacola vêm do Shopify (Storefront API); o pagamento é no checkout dele.
// A sacola é aberta pelo id que só o dono conhece (o id do Shopify carrega uma chave secreta).
const router = Router();

router.get("/loja/produtos", VitrineController.listarProdutos);
router.get("/loja/produtos/:handle", VitrineController.buscarProduto);
router.get("/loja/produtos/:handle/relacionados", VitrineController.listarRelacionados);
router.get("/loja/colecoes", VitrineController.listarColecoes);

// A sacola é da conta: montar e alterar exige login (o visitante é levado a entrar na página da peça).
router.post("/loja/sacolas", authenticateToken, SacolaController.criar);
router.get("/loja/sacolas/minha", authenticateToken, SacolaController.minha);
router.get("/loja/sacolas/:id", SacolaController.buscar);
router.post("/loja/sacolas/:id/linhas", authenticateToken, SacolaController.adicionar);
router.patch("/loja/sacolas/:id/linhas/:linha", authenticateToken, SacolaController.atualizar);
router.delete("/loja/sacolas/:id/linhas/:linha", authenticateToken, SacolaController.remover);
router.post("/loja/sacolas/:id/vincular", authenticateToken, SacolaController.vincular);
// Finalizar exige conta: visitante monta a sacola, mas entra (ou se cadastra) para pagar.
router.post("/loja/sacolas/:id/checkout", authenticateToken, SacolaController.checkout);

// "Meus pedidos": as compras do cliente no checkout do Shopify (Admin API).
router.get("/loja/pedidos", authenticateToken, SacolaController.pedidos);

export default router;
