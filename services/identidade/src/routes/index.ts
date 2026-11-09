import { Router } from "express";
import clientesRoutes from "./clientes.routes";
import identidadeRoutes from "./identidade.routes";

const router = Router();

router.use(identidadeRoutes);
router.use(clientesRoutes);

export default router;
