import {
  authorizeOwnerByBody,
  authorizeOwnerByParam,
  authorizeOwnerByQuery,
} from "../../src/middlewares/ownership.middleware";
import { mockResponse } from "../helpers/http";


type RequestShape = { params?: object; query?: object; body?: object; method?: string };
const mockRequest = (shape: RequestShape) => ({ params: {}, query: {}, body: {}, method: "GET", ...shape });


const cliente = { id_usuario: 1, email: "a@a.com", tipo: "cliente" as const };
const admin = { id_usuario: 9, email: "adm@a.com", tipo: "administrador" as const };

const run = async (
  middleware: (req: never, res: never, next: never) => unknown,
  req: object,
  authUser: object | null = cliente,
) => {
  const res = mockResponse();
  (res as unknown as { locals: object }).locals = { authUser: authUser ?? undefined };
  const next = jest.fn();
  await middleware(req as never, res as never, next as never);
  return { res, next };
};

describe("ownership.middleware", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("authorizeOwnerByParam", () => {
    const middleware = authorizeOwnerByParam("id", async (id) => (id === 10 ? 1 : id === 20 ? 2 : null));

    it("exige autenticação", async () => {
      const { res } = await run(middleware, mockRequest({ params: { id: "10" } }), null);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("permite o dono e bloqueia outro usuário com 403", async () => {
      expect((await run(middleware, mockRequest({ params: { id: "10" } }))).next).toHaveBeenCalled();

      const { res, next } = await run(middleware, mockRequest({ params: { id: "20" } }));
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it("deixa admin, id inválido e recurso inexistente seguirem para o controller", async () => {
      expect((await run(middleware, mockRequest({ params: { id: "20" } }), admin)).next).toHaveBeenCalled();
      expect((await run(middleware, mockRequest({ params: { id: "abc" } }))).next).toHaveBeenCalled();
      expect((await run(middleware, mockRequest({ params: { id: "99" } }))).next).toHaveBeenCalled();
    });
  });

  describe("authorizeOwnerByBody", () => {
    it("bloqueia id_usuario de outra pessoa", async () => {
      const { res } = await run(authorizeOwnerByBody("id_usuario"), mockRequest({ body: { id_usuario: 2 }, method: "POST" }));
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("preenche o id_usuario do token quando ausente na criacao", async () => {
      const req = mockRequest({ body: { cep: "1" }, method: "POST" });
      const { next } = await run(authorizeOwnerByBody("id_usuario"), req);
      expect(next).toHaveBeenCalled();
      expect(req.body).toEqual({ cep: "1", id_usuario: 1 });
    });

    it("não preenche em atualizacao e aceita o próprio id", async () => {
      const req = mockRequest({ body: {}, method: "PUT" });
      await run(authorizeOwnerByBody("id_usuario"), req);
      expect(req.body).toEqual({});
      expect((await run(authorizeOwnerByBody("id_usuario"), mockRequest({ body: { id_usuario: "1" } }))).next).toHaveBeenCalled();
    });

    it("usa o resolver para recursos pais (ex.: carrinho de outra pessoa)", async () => {
      const middleware = authorizeOwnerByBody("id_carrinho", async () => 2);
      const { res } = await run(middleware, mockRequest({ body: { id_carrinho: 5 }, method: "POST" }));
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("libera admin, campo inválido e ausencia de corpo", async () => {
      expect((await run(authorizeOwnerByBody("id_usuario"), mockRequest({ body: { id_usuario: 2 } }), admin)).next).toHaveBeenCalled();
      expect((await run(authorizeOwnerByBody("id_usuario"), mockRequest({ body: { id_usuario: "x" } }))).next).toHaveBeenCalled();
      expect((await run(authorizeOwnerByBody("id_carrinho", async () => 2), mockRequest({ body: undefined, method: "POST" }))).next).toHaveBeenCalled();
    });

    it("exige autenticação", async () => {
      const { res } = await run(authorizeOwnerByBody("id_usuario"), mockRequest({ body: {} }), null);
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe("authorizeOwnerByQuery", () => {
    it("cliente só lista filtrando pelo próprio id", async () => {
      expect((await run(authorizeOwnerByQuery("id_usuario"), mockRequest({ query: { id_usuario: "1" } }))).next).toHaveBeenCalled();
      expect((await run(authorizeOwnerByQuery("id_usuario"), mockRequest({ query: {} }))).res.status).toHaveBeenCalledWith(403);
      expect((await run(authorizeOwnerByQuery("id_usuario"), mockRequest({ query: { id_usuario: "2" } }))).res.status).toHaveBeenCalledWith(403);
    });

    it("admin lista tudo e anonimo recebe 401", async () => {
      expect((await run(authorizeOwnerByQuery("id_usuario"), mockRequest({ query: {} }), admin)).next).toHaveBeenCalled();
      expect((await run(authorizeOwnerByQuery("id_usuario"), mockRequest({ query: {} }), null)).res.status).toHaveBeenCalledWith(401);
    });
  });
});
