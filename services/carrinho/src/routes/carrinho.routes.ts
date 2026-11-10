import { Router } from 'express';
import CarrinhoItensController from '../controllers/carrinhoItens.controller';
import CarrinhosController from '../controllers/carrinhos.controller';
import authenticateToken from '@agnus/comum/middlewares/auth.middleware';
import { authorizeOwnerByBody, authorizeOwnerByParam, authorizeOwnerByQuery } from '@agnus/comum/middlewares/ownership.middleware';
import { OWNERS } from '../middlewares/donos';

// Bounded context Carrinho: a sacola pertence ao usuario do token.
const router = Router();

router.get('/carts', authenticateToken, authorizeOwnerByQuery('id_usuario'), CarrinhosController.findAll);
router.post('/carts', authenticateToken, authorizeOwnerByBody('id_usuario'), CarrinhosController.create);
router.get('/carts/:id', authenticateToken, authorizeOwnerByParam('id', OWNERS.carrinho), CarrinhosController.getById);
router.put('/carts/:id', authenticateToken, authorizeOwnerByParam('id', OWNERS.carrinho), authorizeOwnerByBody('id_usuario'), CarrinhosController.update);
router.delete('/carts/:id', authenticateToken, authorizeOwnerByParam('id', OWNERS.carrinho), CarrinhosController.remove);

router.post('/cart-items', authenticateToken, authorizeOwnerByBody('id_carrinho', OWNERS.carrinho), CarrinhoItensController.create);
router.get('/cart-items/:id_cart', authenticateToken, authorizeOwnerByParam('id_cart', OWNERS.carrinho), CarrinhoItensController.getByIdCart);
router.put('/cart-items/:id', authenticateToken, authorizeOwnerByParam('id', OWNERS.carrinhoItem), authorizeOwnerByBody('id_carrinho', OWNERS.carrinho), CarrinhoItensController.update);
router.delete('/cart-items/:id', authenticateToken, authorizeOwnerByParam('id', OWNERS.carrinhoItem), CarrinhoItensController.remove);

export default router;
