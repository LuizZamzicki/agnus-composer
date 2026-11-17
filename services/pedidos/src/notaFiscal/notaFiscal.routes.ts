import { Request, Response, Router } from "express";
import { PERMISSIONS } from "@agnus/comum/config/permissions";
import authenticateToken, { type AuthenticatedResponseLocals } from "@agnus/comum/middlewares/auth.middleware";
import { checarPermissao } from "@agnus/comum/middlewares/permission.middleware";
import { HttpError } from "@agnus/comum/types/http_error";
import NotaFiscalService from "./notaFiscal.service";

type Resposta = Response<object, AuthenticatedResponseLocals>;

const router = Router();
const id = (valor: unknown) => {
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, "Id inválido.");
  return n;
};
const equipe = [authenticateToken, checarPermissao(PERMISSIONS.PEDIDO_ATUALIZAR)];

// Nota fiscal é dado pessoal: nada de cache.
router.use(["/orders/:id/nota-fiscal", "/notas-fiscais"], (_req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  next();
});

// ---- Cliente (dono do pedido) ou equipe ----
router.get("/orders/:id/nota-fiscal", authenticateToken, async (req: Request, res: Resposta) =>
  res.json(await NotaFiscalService.daPedido(id(req.params.id), res.locals.authUser!)),
);

// PDF abre no navegador; XML vem como download.
router.get("/orders/:id/nota-fiscal/:tipo", authenticateToken, async (req: Request, res: Resposta) => {
  if (req.params.tipo !== "pdf" && req.params.tipo !== "xml") throw new HttpError(404, "Arquivo da nota não encontrado.");
  const tipo = req.params.tipo;
  const arquivo = await NotaFiscalService.arquivo(id(req.params.id), tipo, res.locals.authUser!);
  res.set("Content-Type", arquivo.tipo);
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Content-Disposition", `${tipo === "pdf" ? "inline" : "attachment"}; filename="${arquivo.nome}"`);
  return res.sendFile(arquivo.caminho, (erro) => {
    if (erro && !res.headersSent) res.status(404).json({ message: "Arquivo da nota não encontrado." });
  });
});

// ---- Equipe: anexar, trocar ou remover (corpo grande: PDF/XML em base64) ----
router.put("/notas-fiscais/:id", ...equipe, async (req: Request, res: Resposta) =>
  res.json(await NotaFiscalService.salvar(id(req.params.id), req.body && typeof req.body === "object" ? req.body : {})),
);
router.delete("/notas-fiscais/:id", ...equipe, async (req: Request, res: Resposta) => {
  await NotaFiscalService.remover(id(req.params.id));
  return res.status(204).send();
});

export default router;
