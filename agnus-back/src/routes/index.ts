import { Router } from 'express';
import avaliacoesRoutes from './avaliacoes.routes';
import carrinhoRoutes from './carrinho.routes';
import catalogoRoutes from './catalogo.routes';
import clientesRoutes from './clientes.routes';
import identidadeRoutes from './identidade.routes';
import pedidosRoutes from './pedidos.routes';

// Um modulo de rotas por bounded context (ver docs/arquitetura/ddd.md).
const router = Router();

router.use(identidadeRoutes);
router.use(clientesRoutes);
router.use(catalogoRoutes);
router.use(avaliacoesRoutes);
router.use(carrinhoRoutes);
router.use(pedidosRoutes);

export default router;
