import { Router } from 'express';
import PedidoItensController from '../controllers/pedidoItens.controller';
import PedidosController from '../controllers/pedidos.controller';
import { PERMISSIONS } from '@agnus/comum/config/permissions';
import authenticateToken from '@agnus/comum/middlewares/auth.middleware';
import { authorizeOrderOwnerOrAdmin } from '../middlewares/pedidoAuthorization.middleware';
import { checarPermissao } from '@agnus/comum/middlewares/permission.middleware';

// Bounded context Pedidos. O cliente so cria pedido por /orders/checkout (total calculado no
// servidor); lancamento manual e alteracao de itens sao exclusivos da equipe.
const router = Router();

router.get('/orders', authenticateToken, checarPermissao(PERMISSIONS.PEDIDO_LISTAR), PedidosController.findAll);
router.post('/orders', authenticateToken, checarPermissao(PERMISSIONS.PEDIDO_CRIAR), PedidosController.create);
router.post('/orders/checkout', authenticateToken, PedidosController.checkout);
router.get('/orders/me', authenticateToken, PedidosController.findMine);
router.get('/orders/:id', authenticateToken, authorizeOrderOwnerOrAdmin('id'), PedidosController.getById);
router.put('/orders/:id', authenticateToken, checarPermissao(PERMISSIONS.PEDIDO_ATUALIZAR), PedidosController.update);
router.delete('/orders/:id', authenticateToken, checarPermissao(PERMISSIONS.PEDIDO_EXCLUIR), PedidosController.remove);

router.post('/order-items', authenticateToken, checarPermissao(PERMISSIONS.PEDIDO_ATUALIZAR), PedidoItensController.create);
router.get('/order-items/:id_order', authenticateToken, authorizeOrderOwnerOrAdmin('id_order'), PedidoItensController.getByIdOrder);
router.put('/order-items/:id', authenticateToken, checarPermissao(PERMISSIONS.PEDIDO_ATUALIZAR), PedidoItensController.update);
router.delete('/order-items/:id', authenticateToken, checarPermissao(PERMISSIONS.PEDIDO_ATUALIZAR), PedidoItensController.remove);

export default router;
