import { Router } from "express";
import { PERMISSIONS } from "@agnus/comum/config/permissions";
import authenticateToken from "@agnus/comum/middlewares/auth.middleware";
import { checarPermissao } from "@agnus/comum/middlewares/permission.middleware";
import { uploadAny } from "@agnus/comum/middlewares/upload.middleware";
import { HttpError } from "@agnus/comum/types/http_error";
import VitrineService, { categoriasDaVitrine, definirFotoDaCategoria } from "../services/vitrine.service";

// Vitrine da página inicial: banners com foto grande (equipe cadastra) e "compre por categoria".
const router = Router();

const id = (valor: unknown) => {
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, "ID do banner inválido.");
  return n;
};
type Arquivos = Parameters<typeof VitrineService.criar>[1];

router.get("/vitrine/banners", async (_req, res) => {
  res.set("Cache-Control", "public, max-age=60");
  res.json({ data: await VitrineService.ativos() });
});

router.get("/vitrine/categorias", async (_req, res) => {
  res.set("Cache-Control", "public, max-age=60");
  res.json({ data: await categoriasDaVitrine() });
});

router.put("/vitrine/categorias/:id/foto", authenticateToken, checarPermissao(PERMISSIONS.PRODUTO_EDITAR), uploadAny, async (req, res) => {
  const idCategoria = Number(req.params.id);
  if (!Number.isInteger(idCategoria) || idCategoria <= 0) throw new HttpError(400, "ID da categoria inválido.");
  const arquivos = ((req.files ?? []) as NonNullable<Arquivos>);
  const remover = req.body?.remover === "true" || req.body?.remover === true;
  res.json({ imagem_url: await definirFotoDaCategoria(idCategoria, arquivos.find((a) => a.fieldname === "imagem"), remover) });
});

router.get("/vitrine/banners/todos", authenticateToken, checarPermissao(PERMISSIONS.PRODUTO_EDITAR), async (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ data: await VitrineService.todos() });
});

router.post("/vitrine/banners", authenticateToken, checarPermissao(PERMISSIONS.PRODUTO_EDITAR), uploadAny, async (req, res) => {
  const banner = await VitrineService.criar(req.body ?? {}, (req.files ?? []) as Arquivos);
  res.status(201).json({ id_banner: banner.id_banner });
});

router.put("/vitrine/banners/:id", authenticateToken, checarPermissao(PERMISSIONS.PRODUTO_EDITAR), uploadAny, async (req, res) => {
  const banner = await VitrineService.atualizar(id(req.params.id), req.body ?? {}, (req.files ?? []) as Arquivos);
  res.json({ id_banner: banner.id_banner });
});

router.delete("/vitrine/banners/:id", authenticateToken, checarPermissao(PERMISSIONS.PRODUTO_EDITAR), async (req, res) => {
  await VitrineService.remover(id(req.params.id));
  res.status(204).end();
});

export default router;
