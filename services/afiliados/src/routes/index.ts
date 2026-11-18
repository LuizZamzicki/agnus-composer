import { Request, Router } from "express";
import authenticateToken, { authorizeRoles } from "@agnus/comum/middlewares/auth.middleware";
import { HttpError } from "@agnus/comum/types/http_error";
import { afiliadoDaSessao, autenticarAfiliado, exigirAfiliadoAtivo, type RespostaAfiliado } from "../middlewares/afiliado.middleware";
import AdminService from "../services/admin.service";
import AfiliadoService, { serializarAfiliado } from "../services/afiliado.service";
import LinkService, { serializarLink } from "../services/link.service";
import OfertaService from "../services/oferta.service";
import RelatorioService from "../services/relatorio.service";

const router = Router();
const corpo = (req: Request) => (req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {});
const query = (req: Request) => req.query as Record<string, unknown>;
const id = (valor: unknown) => {
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, "Id inválido.");
  return n;
};

// Relatório e dados do programa são pessoais: nada de cache em proxy ou navegador.
router.use("/afiliados", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// ---------------- Link curto (público) ----------------
// https://<loja>/l/<slug>: registra o clique, grava o cookie de atribuição e abre a página da loja.
router.get("/l/:slug", async (req: Request, res: RespostaAfiliado) => {
  const resultado = await LinkService.registrarClique(String(req.params.slug), {
    ip: req.ip,
    userAgent: req.header("user-agent"),
    referer: req.header("referer"),
  });

  if (!resultado) return res.redirect(302, "/");

  if (resultado.cookie) {
    res.cookie("agnus_afiliado", resultado.cookie.valor, {
      maxAge: resultado.cookie.maxAge * 1000,
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });
  }

  res.set("Cache-Control", "no-store");
  res.set("Referrer-Policy", "no-referrer");
  return res.redirect(302, resultado.destino);
});

// ---------------- Conta do afiliado (sessão do site) ----------------
router.post("/afiliados/inscricao", authenticateToken, async (req: Request, res: RespostaAfiliado) => {
  const afiliado = await AfiliadoService.inscrever(res.locals.authUser!.id_usuario, corpo(req));
  return res.status(201).json(serializarAfiliado(afiliado));
});

router.get("/afiliados/me", autenticarAfiliado, async (_req: Request, res: RespostaAfiliado) =>
  res.json({ ...serializarAfiliado(res.locals.afiliado!), resumo: await RelatorioService.resumo(res.locals.afiliado!) }),
);

router.patch("/afiliados/me", afiliadoDaSessao, async (req: Request, res: RespostaAfiliado) =>
  res.json(serializarAfiliado(await AfiliadoService.atualizar(res.locals.afiliado!, corpo(req)))),
);

// Só pela sessão do site: a integração não pode trocar a própria credencial.
router.post("/afiliados/me/credenciais", afiliadoDaSessao, async (_req: Request, res: RespostaAfiliado) =>
  res.status(201).json({
    ...(await AfiliadoService.gerarCredenciais(res.locals.afiliado!)),
    aviso: "Guarde o segredo agora: ele não aparece de novo. Gerar outro invalida este.",
  }),
);

router.get("/afiliados/me/pagamentos", autenticarAfiliado, async (req: Request, res: RespostaAfiliado) =>
  res.json(await AdminService.listarPagamentos(query(req), res.locals.afiliado!.id_afiliado)),
);

// ---------------- API do afiliado v1 (equivalente à Shopee Affiliate Open API) ----------------
const v1 = Router();
v1.use(autenticarAfiliado, exigirAfiliadoAtivo);

// productOfferV2
v1.get("/ofertas", async (req: Request, res: RespostaAfiliado) => res.json(await OfertaService.listar(res.locals.afiliado!, query(req))));

// generateShortLink
v1.post("/links", async (req: Request, res: RespostaAfiliado) => {
  const link = await LinkService.criar(res.locals.afiliado!, corpo(req).url, corpo(req).sub_ids);
  return res.status(201).json(serializarLink(link));
});

// conversionReport
v1.get("/conversoes", async (req: Request, res: RespostaAfiliado) =>
  res.json(await RelatorioService.conversoes({ id_afiliado: res.locals.afiliado!.id_afiliado }, query(req))),
);

// validatedReport
v1.get("/conversoes/validadas", async (req: Request, res: RespostaAfiliado) =>
  res.json(await RelatorioService.validadas(res.locals.afiliado!, query(req))),
);

v1.get("/cliques", async (req: Request, res: RespostaAfiliado) => res.json(await RelatorioService.cliques(res.locals.afiliado!, query(req))));

router.use("/afiliados/v1", v1);

// ---------------- Administração (equipe da loja) ----------------
const admin = Router();
admin.use(authenticateToken, authorizeRoles("administrador"));

admin.get("/afiliados", async (req: Request, res: RespostaAfiliado) => res.json(await AdminService.listarAfiliados(query(req))));
admin.patch("/afiliados/:id", async (req: Request, res: RespostaAfiliado) =>
  res.json(await AdminService.atualizarAfiliado(id(req.params.id), corpo(req))),
);
admin.get("/regras", async (_req: Request, res: RespostaAfiliado) => res.json(await AdminService.listarRegras()));
admin.put("/regras", async (req: Request, res: RespostaAfiliado) => res.json(await AdminService.salvarRegra(corpo(req))));
admin.delete("/regras/:id", async (req: Request, res: RespostaAfiliado) => {
  await AdminService.removerRegra(id(req.params.id));
  return res.status(204).send();
});
admin.get("/conversoes", async (req: Request, res: RespostaAfiliado) =>
  res.json(
    await RelatorioService.conversoes({ id_afiliado: req.query.id_afiliado ? id(req.query.id_afiliado) : undefined }, query(req), true),
  ),
);
admin.get("/saldos", async (_req: Request, res: RespostaAfiliado) => res.json(await AdminService.saldos()));
admin.post("/afiliados/:id/pagamentos", async (req: Request, res: RespostaAfiliado) =>
  res.status(201).json(await AdminService.registrarPagamento(id(req.params.id), corpo(req), res.locals.authUser!.id_usuario)),
);
admin.get("/pagamentos", async (req: Request, res: RespostaAfiliado) => res.json(await AdminService.listarPagamentos(query(req))));

router.use("/afiliados/admin", admin);

export default router;
