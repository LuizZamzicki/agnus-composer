import { Router } from 'express';
import AvaliacaoFotosController from '../controllers/avaliacaoFotos.controller';
import AvaliacaoProdutosController from '../controllers/avaliacaoProdutos.controller';
import authenticateToken from '@agnus/comum/middlewares/auth.middleware';
import { authorizeOwnerByBody, authorizeOwnerByParam } from '@agnus/comum/middlewares/ownership.middleware';
import { OWNERS } from '../middlewares/donos';
import { uploadFotosAvaliacao } from '@agnus/comum/middlewares/upload.middleware';

// Bounded context Avaliacoes: leitura publica; escrita so pelo autor da avaliacao.
const router = Router();

router.post('/product-reviews', authenticateToken, authorizeOwnerByBody('id_usuario'), AvaliacaoProdutosController.create);
router.get('/product-reviews/:id_produto', AvaliacaoProdutosController.getByIdProduto);
router.put('/product-reviews/:id', authenticateToken, authorizeOwnerByParam('id', OWNERS.avaliacao), authorizeOwnerByBody('id_usuario'), AvaliacaoProdutosController.update);
router.delete('/product-reviews/:id', authenticateToken, authorizeOwnerByParam('id', OWNERS.avaliacao), AvaliacaoProdutosController.remove);

// Multipart: o corpo so existe depois do Multer, por isso a checagem do corpo vem apos o upload.
router.post('/product-review-photos', authenticateToken, uploadFotosAvaliacao, authorizeOwnerByBody('id_avaliacao_produto', OWNERS.avaliacao), AvaliacaoFotosController.create);
router.get('/product-review-photos/:id_review', AvaliacaoFotosController.getByIdReview);
router.put('/product-review-photos/:id', authenticateToken, authorizeOwnerByParam('id', OWNERS.avaliacaoFoto), uploadFotosAvaliacao, authorizeOwnerByBody('id_avaliacao_produto', OWNERS.avaliacao), AvaliacaoFotosController.update);
router.delete('/product-review-photos/:id', authenticateToken, authorizeOwnerByParam('id', OWNERS.avaliacaoFoto), AvaliacaoFotosController.remove);

export default router;
