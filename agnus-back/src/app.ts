import express, { Request, Response, Router } from 'express';
import fs from 'fs';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import { parse as parseYaml } from 'yaml';
import AvaliacaoFotosController from './controllers/avaliacaoFotos.controller';
import AvaliacaoProdutosController from './controllers/avaliacaoProdutos.controller';
import AuthController from './controllers/auth.controller';
import CarrinhoItensController from './controllers/carrinhoItens.controller';
import CarrinhosController from './controllers/carrinhos.controller';
import CategoriasController from './controllers/categorias.controller';
import PedidoItensController from './controllers/pedidoItens.controller';
import ProdutoCoresController from './controllers/produtoCores.controller';
import ProdutoFotosController from './controllers/produtoFotos.controller';
import ProdutoGradesController from './controllers/produtoGrades.controller';
import ProdutosController from './controllers/produtos.controller';
import PedidosController from './controllers/pedidos.controller';
import UsuarioContatosController from './controllers/usuarioContatos.controller';
import UsuarioEnderecosController from './controllers/usuarioEnderecos.controller';
import UsersController from './controllers/usuarios.controller';
import authenticateToken, { authorizeRoles, authorizeSelfOrAdmin } from './middlewares/auth.middleware';
import { errorHandler } from './middlewares/error.middleware';
import {
  authorizeOpenOrderBody,
  authorizeOwnerByBody,
  authorizeOwnerByParam,
  authorizeOwnerByQuery,
  OWNERS,
} from './middlewares/ownership.middleware';
import { authorizeOrderOwnerOrAdmin, authorizeOwnOrderBody } from './middlewares/pedidoAuthorization.middleware';
import { checarPermissao } from './middlewares/permission.middleware';
import { PERMISSIONS } from './config/permissions';
import { uploadAny } from './middlewares/upload.middleware';
import { requestLogger } from './middlewares/requestLogger.middleware';
import { getMetricsSnapshot } from './utils/metrics';
import cors from "cors";

const app = express();

app.use(requestLogger);
app.use(cors());

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

app.use('/produto_fotos', express.static(path.resolve(process.cwd(), 'produto_fotos')));
app.use('/avaliacao_fotos', express.static(path.resolve(process.cwd(), 'avaliacao_fotos')));

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/metrics', authenticateToken, authorizeRoles('administrador'), (_req: Request, res: Response) => {
  res.status(200).json(getMetricsSnapshot());
});

const openApiPath = path.resolve(process.cwd(), 'openapi.yaml');

if (fs.existsSync(openApiPath)) {
  const openApiDocument = parseYaml(fs.readFileSync(openApiPath, 'utf8'));

  app.get('/openapi.json', (_req: Request, res: Response) => {
    res.status(200).json(openApiDocument);
  });
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument, { customSiteTitle: 'Agnus API' }));
}

const router: Router = Router();

router.post('/users', UsersController.create);
router.get('/users', authenticateToken, checarPermissao(PERMISSIONS.USUARIO_LISTAR), UsersController.findAll);
router.get('/users/:id', authenticateToken, authorizeSelfOrAdmin('id'), UsersController.getById);
router.delete('/users/:id', authenticateToken, checarPermissao(PERMISSIONS.USUARIO_EXCLUIR), UsersController.remove);
router.put('/users/:id', authenticateToken, authorizeSelfOrAdmin('id'), UsersController.update);
router.patch('/users/:id/password', authenticateToken, authorizeSelfOrAdmin('id'), UsersController.updatePassword);

const auth = authenticateToken;

router.post('/user-addresses', auth, authorizeOwnerByBody('id_usuario'), UsuarioEnderecosController.create);
router.get('/user-addresses/:id_user', auth, authorizeSelfOrAdmin('id_user'), UsuarioEnderecosController.getByIdUser);
router.put('/user-addresses/:id', auth, authorizeOwnerByParam('id', OWNERS.endereco), authorizeOwnerByBody('id_usuario'), UsuarioEnderecosController.update);
router.delete('/user-addresses/:id', auth, authorizeOwnerByParam('id', OWNERS.endereco), UsuarioEnderecosController.remove);

router.post('/user-contacts', auth, authorizeOwnerByBody('id_usuario'), UsuarioContatosController.create);
router.get('/user-contacts/:id_user', auth, authorizeSelfOrAdmin('id_user'), UsuarioContatosController.getByIdUser);
router.put('/user-contacts/:id', auth, authorizeOwnerByParam('id', OWNERS.contato), authorizeOwnerByBody('id_usuario'), UsuarioContatosController.update);
router.delete('/user-contacts/:id', auth, authorizeOwnerByParam('id', OWNERS.contato), UsuarioContatosController.remove);

router.get('/categories', CategoriasController.findAll);
router.post('/categories', authenticateToken, checarPermissao(PERMISSIONS.CATEGORIA_CRIAR), CategoriasController.create);
router.get('/categories/:id', CategoriasController.getById);
router.put('/categories/:id', authenticateToken, checarPermissao(PERMISSIONS.CATEGORIA_EDITAR), CategoriasController.update);
router.delete('/categories/:id', authenticateToken, checarPermissao(PERMISSIONS.CATEGORIA_EXCLUIR), CategoriasController.remove);

router.get('/products', ProdutosController.findAll);
router.get('/products/catalog', ProdutosController.catalog);
router.get('/products/best-sellers', ProdutosController.bestSellers);
router.post('/products', authenticateToken, checarPermissao(PERMISSIONS.PRODUTO_CRIAR), ProdutosController.create);
router.get('/products/:id', ProdutosController.getById);
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

router.post('/product-reviews', auth, authorizeOwnerByBody('id_usuario'), AvaliacaoProdutosController.create);
router.get('/product-reviews/:id_produto', AvaliacaoProdutosController.getByIdProduto);
router.put('/product-reviews/:id', auth, authorizeOwnerByParam('id', OWNERS.avaliacao), authorizeOwnerByBody('id_usuario'), AvaliacaoProdutosController.update);
router.delete('/product-reviews/:id', auth, authorizeOwnerByParam('id', OWNERS.avaliacao), AvaliacaoProdutosController.remove);

// Multipart: o corpo so existe depois do Multer, por isso a checagem do corpo vem apos o upload.
router.post('/product-review-photos', auth, uploadAny, authorizeOwnerByBody('id_avaliacao_produto', OWNERS.avaliacao), AvaliacaoFotosController.create);
router.get('/product-review-photos/:id_review', AvaliacaoFotosController.getByIdReview);
router.put('/product-review-photos/:id', auth, authorizeOwnerByParam('id', OWNERS.avaliacaoFoto), uploadAny, authorizeOwnerByBody('id_avaliacao_produto', OWNERS.avaliacao), AvaliacaoFotosController.update);
router.delete('/product-review-photos/:id', auth, authorizeOwnerByParam('id', OWNERS.avaliacaoFoto), AvaliacaoFotosController.remove);

router.get('/carts', auth, authorizeOwnerByQuery('id_usuario'), CarrinhosController.findAll);
router.post('/carts', auth, authorizeOwnerByBody('id_usuario'), CarrinhosController.create);
router.get('/carts/:id', auth, authorizeOwnerByParam('id', OWNERS.carrinho), CarrinhosController.getById);
router.put('/carts/:id', auth, authorizeOwnerByParam('id', OWNERS.carrinho), authorizeOwnerByBody('id_usuario'), CarrinhosController.update);
router.delete('/carts/:id', auth, authorizeOwnerByParam('id', OWNERS.carrinho), CarrinhosController.remove);

router.post('/cart-items', auth, authorizeOwnerByBody('id_carrinho', OWNERS.carrinho), CarrinhoItensController.create);
router.get('/cart-items/:id_cart', auth, authorizeOwnerByParam('id_cart', OWNERS.carrinho), CarrinhoItensController.getByIdCart);
router.put('/cart-items/:id', auth, authorizeOwnerByParam('id', OWNERS.carrinhoItem), authorizeOwnerByBody('id_carrinho', OWNERS.carrinho), CarrinhoItensController.update);
router.delete('/cart-items/:id', auth, authorizeOwnerByParam('id', OWNERS.carrinhoItem), CarrinhoItensController.remove);

router.get('/orders', authenticateToken, checarPermissao(PERMISSIONS.PEDIDO_LISTAR), PedidosController.findAll);
router.post('/orders', authenticateToken, authorizeOwnOrderBody('id_usuario'), PedidosController.create);
router.post('/orders/checkout', authenticateToken, PedidosController.checkout);
router.get('/orders/me', authenticateToken, PedidosController.findMine);
router.get('/orders/:id', authenticateToken, authorizeOrderOwnerOrAdmin('id'), PedidosController.getById);
router.put('/orders/:id', authenticateToken, checarPermissao(PERMISSIONS.PEDIDO_ATUALIZAR), PedidosController.update);
router.delete('/orders/:id', authenticateToken, checarPermissao(PERMISSIONS.PEDIDO_EXCLUIR), PedidosController.remove);

router.post('/order-items', auth, authorizeOpenOrderBody('id_pedido'), PedidoItensController.create);
router.get('/order-items/:id_order', auth, authorizeOrderOwnerOrAdmin('id_order'), PedidoItensController.getByIdOrder);
router.put('/order-items/:id', auth, checarPermissao(PERMISSIONS.PEDIDO_ATUALIZAR), PedidoItensController.update);
router.delete('/order-items/:id', auth, checarPermissao(PERMISSIONS.PEDIDO_ATUALIZAR), PedidoItensController.remove);

router.post('/auth/login', AuthController.login);
router.get('/auth/me', authenticateToken, AuthController.me);
router.get('/auth/google', AuthController.googleStart);
router.get('/auth/google/callback', AuthController.googleCallback);

app.use(router);

app.use(errorHandler);

export default app;
