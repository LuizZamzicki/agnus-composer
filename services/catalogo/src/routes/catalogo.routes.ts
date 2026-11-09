import { Router } from 'express';
import CategoriasController from '../controllers/categorias.controller';
import ProdutoCoresController from '../controllers/produtoCores.controller';
import ProdutoFotosController from '../controllers/produtoFotos.controller';
import ProdutoGradesController from '../controllers/produtoGrades.controller';
import ProdutosController from '../controllers/produtos.controller';
import { PERMISSIONS } from '@agnus/comum/config/permissions';
import authenticateToken, { identifyOptionalUser } from '@agnus/comum/middlewares/auth.middleware';
import { checarPermissao } from '@agnus/comum/middlewares/permission.middleware';
import { uploadAny } from '@agnus/comum/middlewares/upload.middleware';

// Bounded context Catalogo: leitura publica (com cache) e escrita so para a equipe.
const router = Router();

router.get('/categories', CategoriasController.findAll);
router.post('/categories', authenticateToken, checarPermissao(PERMISSIONS.CATEGORIA_CRIAR), CategoriasController.create);
router.get('/categories/:id', CategoriasController.getById);
router.put('/categories/:id', authenticateToken, checarPermissao(PERMISSIONS.CATEGORIA_EDITAR), CategoriasController.update);
router.delete('/categories/:id', authenticateToken, checarPermissao(PERMISSIONS.CATEGORIA_EXCLUIR), CategoriasController.remove);

router.get('/products', identifyOptionalUser, ProdutosController.findAll);
router.get('/products/catalog', ProdutosController.catalog);
router.get('/products/best-sellers', ProdutosController.bestSellers);
router.post('/products', authenticateToken, checarPermissao(PERMISSIONS.PRODUTO_CRIAR), ProdutosController.create);
router.get('/products/:id', identifyOptionalUser, ProdutosController.getById);
router.put('/products/:id', authenticateToken, checarPermissao(PERMISSIONS.PRODUTO_EDITAR), ProdutosController.update);
router.delete('/products/:id', authenticateToken, checarPermissao(PERMISSIONS.PRODUTO_EXCLUIR), ProdutosController.remove);

router.post('/product-colors', authenticateToken, checarPermissao(PERMISSIONS.PRODUTO_COR_CRIAR), ProdutoCoresController.create);
router.get('/product-colors/:id_produto', ProdutoCoresController.getByIdProduto);
router.put('/product-colors/:id', authenticateToken, checarPermissao(PERMISSIONS.PRODUTO_COR_EDITAR), ProdutoCoresController.update);
router.delete('/product-colors/:id', authenticateToken, checarPermissao(PERMISSIONS.PRODUTO_COR_EXCLUIR), ProdutoCoresController.remove);

router.post('/product-photos', authenticateToken, checarPermissao(PERMISSIONS.PRODUTO_FOTO_CRIAR), uploadAny, ProdutoFotosController.create);
router.get('/product-photos/:id_produto', ProdutoFotosController.getByIdProduto);
router.put('/product-photos/:id', authenticateToken, checarPermissao(PERMISSIONS.PRODUTO_FOTO_EDITAR), uploadAny, ProdutoFotosController.update);
router.delete('/product-photos/:id', authenticateToken, checarPermissao(PERMISSIONS.PRODUTO_FOTO_EXCLUIR), ProdutoFotosController.remove);

router.post('/product-grades', authenticateToken, checarPermissao(PERMISSIONS.PRODUTO_GRADE_CRIAR), ProdutoGradesController.create);
router.get('/product-grades/:id_produto', ProdutoGradesController.getByIdProduto);
router.put('/product-grades/:id', authenticateToken, checarPermissao(PERMISSIONS.PRODUTO_GRADE_EDITAR), ProdutoGradesController.update);
router.delete('/product-grades/:id', authenticateToken, checarPermissao(PERMISSIONS.PRODUTO_GRADE_EXCLUIR), ProdutoGradesController.remove);

export default router;
