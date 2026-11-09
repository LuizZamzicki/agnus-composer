import { Request, Response, Router } from "express";
import swaggerUi from "swagger-ui-express";
import authenticateToken, { authorizeRoles } from "@agnus/comum/middlewares/auth.middleware";
import AdminService, { SERVICOS_COM_METRICAS } from "../services/admin.service";

const router = Router();
const somenteEquipe = [authenticateToken, authorizeRoles("administrador")];

router.get("/admin/dashboard", somenteEquipe, async (req: Request, res: Response) => {
  res.status(200).json(await AdminService.dashboard(req.header("authorization")!));
});

router.get("/metrics", somenteEquipe, async (req: Request, res: Response) => {
  res.status(200).json(await AdminService.metricas(req.header("authorization")!));
});

router.use("/docs", swaggerUi.serve, swaggerUi.setup(undefined, {
  customSiteTitle: "Agnus API",
  swaggerOptions: {
    urls: SERVICOS_COM_METRICAS.filter((servico) => servico !== "busca").map((servico) => ({
      url: `/api/specs/${servico}.json`,
      name: servico,
    })),
  },
}));

export default router;
