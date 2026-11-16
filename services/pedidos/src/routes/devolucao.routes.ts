import { Request, Response, Router } from "express";
import { PERMISSIONS } from "@agnus/comum/config/permissions";
import authenticateToken, { type AuthenticatedResponseLocals } from "@agnus/comum/middlewares/auth.middleware";
import { checarPermissao } from "@agnus/comum/middlewares/permission.middleware";
import { HttpError } from "@agnus/comum/types/http_error";
import DevolucaoService from "../services/devolucao.service";

type Resposta = Response<object, AuthenticatedResponseLocals>;

const router = Router();
const id = (valor: unknown) => {
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, "Id inválido.");
  return n;
};
const corpo = (req: Request) => (req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {});
const cliente = (res: Resposta) => ({ id_usuario: res.locals.authUser!.id_usuario });
const equipe = [authenticateToken, checarPermissao(PERMISSIONS.PEDIDO_ATUALIZAR)];

// Devolução é dado pessoal e muda de status: nada de cache.
router.use(["/devolucoes", "/devolucao-fotos", "/orders/:id/devolucao", "/orders/:id/devolucoes"], (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// ---- Cliente ----
router.get("/orders/:id/devolucao/opcoes", authenticateToken, async (req: Request, res: Resposta) =>
  res.json(await DevolucaoService.opcoes(id(req.params.id), cliente(res))),
);
router.post("/orders/:id/devolucoes", authenticateToken, async (req: Request, res: Resposta) =>
  res.status(201).json(await DevolucaoService.solicitar(id(req.params.id), cliente(res), corpo(req))),
);
router.get("/devolucoes/me", authenticateToken, async (_req: Request, res: Resposta) =>
  res.json(await DevolucaoService.minhas(res.locals.authUser!.id_usuario)),
);
router.post("/devolucoes/:id/cancelar", authenticateToken, async (req: Request, res: Resposta) =>
  res.json(await DevolucaoService.cancelar(id(req.params.id), cliente(res))),
);

// Fotos: o cliente anexa uma por vez (até 3); a leitura exige login (dono ou equipe) e nunca é pública.
router.post("/devolucao-fotos/:id", authenticateToken, async (req: Request, res: Resposta) =>
  res.status(201).json(await DevolucaoService.enviarFoto(id(req.params.id), cliente(res), corpo(req))),
);
router.get("/devolucao-fotos/:id", authenticateToken, async (req: Request, res: Resposta) => {
  const foto = await DevolucaoService.lerFoto(id(req.params.id), res.locals.authUser!);
  res.set("Content-Type", foto.tipo);
  res.set("Cache-Control", "private, no-store");
  res.set("X-Content-Type-Options", "nosniff");
  return res.sendFile(foto.caminho, (erro) => {
    if (erro && !res.headersSent) res.status(404).json({ message: "Foto não encontrada." });
  });
});

// ---- Equipe da loja ----
router.get("/devolucoes", ...equipe, async (req: Request, res: Resposta) =>
  res.json(await DevolucaoService.listar(req.query as Record<string, unknown>)),
);
router.post("/devolucoes/:id/aprovar", ...equipe, async (req: Request, res: Resposta) =>
  res.json(await DevolucaoService.aprovar(id(req.params.id), corpo(req))),
);
router.post("/devolucoes/:id/recusar", ...equipe, async (req: Request, res: Resposta) =>
  res.json(await DevolucaoService.recusar(id(req.params.id), corpo(req))),
);
router.post("/devolucoes/:id/recebida", ...equipe, async (req: Request, res: Resposta) =>
  res.json(await DevolucaoService.receber(id(req.params.id))),
);
router.post("/devolucoes/:id/reembolsar", ...equipe, async (req: Request, res: Resposta) =>
  res.json(await DevolucaoService.reembolsar(id(req.params.id), corpo(req))),
);

export default router;
