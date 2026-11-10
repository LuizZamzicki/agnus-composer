import {
  authorizeOwnerByBody,
  authorizeOwnerByParam,
  authorizeOwnerByQuery,
  OWNERS,
} from "../../src/middlewares/ownership.middleware";
import AvaliacaoFotos from "../../src/models/AvaliacaoFotos";
import AvaliacaoProdutos from "../../src/models/AvaliacaoProdutos";
import CarrinhoItens from "../../src/models/CarrinhoItens";
import Carrinhos from "../../src/models/Carrinhos";
import Pedidos from "../../src/models/Pedidos";
import UsuarioContatos from "../../src/models/UsuarioContatos";
import UsuarioEnderecos from "../../src/models/UsuarioEnderecos";
import { mockResponse } from "../helpers/http";

jest.mock("../../src/models/AvaliacaoFotos", () => ({ __esModule: true, default: { findByPk: jest.fn() } }));
jest.mock("../../src/models/AvaliacaoProdutos", () => ({ __esModule: true, default: { findByPk: jest.fn() } }));
jest.mock("../../src/models/CarrinhoItens", () => ({ __esModule: true, default: { findByPk: jest.fn() } }));
jest.mock("../../src/models/Carrinhos", () => ({ __esModule: true, default: { findByPk: jest.fn() } }));
jest.mock("../../src/models/Pedidos", () => ({ __esModule: true, default: { findByPk: jest.fn() } }));
jest.mock("../../src/models/UsuarioContatos", () => ({ __esModule: true, default: { findByPk: jest.fn() } }));
jest.mock("../../src/models/UsuarioEnderecos", () => ({ __esModule: true, default: { findByPk: jest.fn() } }));

type RequestShape = { params?: object; query?: object; body?: object; method?: string };
const mockRequest = (shape: RequestShape) => ({ params: {}, query: {}, body: {}, method: "GET", ...shape });

const findByPk = (model: unknown) => (model as { findByPk: jest.Mock }).findByPk;

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

  describe("resolvers de dono", () => {
    it("resolvem o usuario direto e por recursos pais", async () => {
      findByPk(UsuarioEnderecos).mockResolvedValueOnce({ id_usuario: 3 });
      findByPk(UsuarioContatos).mockResolvedValueOnce({ id_usuario: 4 });
      findByPk(Pedidos).mockResolvedValueOnce({ id_usuario: 5 });
      findByPk(AvaliacaoFotos).mockResolvedValueOnce({ id_avaliacao_produto: 7 });
      findByPk(AvaliacaoProdutos).mockResolvedValueOnce({ id_usuario: 6 });
      findByPk(CarrinhoItens).mockResolvedValueOnce({ id_carrinho: 8 });
      findByPk(Carrinhos).mockResolvedValueOnce({ id_usuario: 2 });

      await expect(OWNERS.endereco(1)).resolves.toBe(3);
      await expect(OWNERS.contato(1)).resolves.toBe(4);
      await expect(OWNERS.pedido(1)).resolves.toBe(5);
      await expect(OWNERS.avaliacaoFoto(1)).resolves.toBe(6);
      await expect(OWNERS.carrinhoItem(1)).resolves.toBe(2);
    });

    it("retornam null quando o recurso nao existe", async () => {
      findByPk(AvaliacaoFotos).mockResolvedValueOnce(null);
      findByPk(CarrinhoItens).mockResolvedValueOnce(null);
      findByPk(Carrinhos).mockResolvedValueOnce(null);
      findByPk(AvaliacaoProdutos).mockResolvedValueOnce(null);

      await expect(OWNERS.avaliacaoFoto(1)).resolves.toBeNull();
      await expect(OWNERS.carrinhoItem(1)).resolves.toBeNull();
      await expect(OWNERS.carrinho(1)).resolves.toBeNull();
      await expect(OWNERS.avaliacao(1)).resolves.toBeNull();
    });
  });

  describe("authorizeOwnerByParam", () => {
    const middleware = authorizeOwnerByParam("id", async (id) => (id === 10 ? 1 : id === 20 ? 2 : null));

    it("exige autenticacao", async () => {
      const { res } = await run(middleware, mockRequest({ params: { id: "10" } }), null);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("permite o dono e bloqueia outro usuario com 403", async () => {
      expect((await run(middleware, mockRequest({ params: { id: "10" } }))).next).toHaveBeenCalled();

      const { res, next } = await run(middleware, mockRequest({ params: { id: "20" } }));
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it("deixa admin, id invalido e recurso inexistente seguirem para o controller", async () => {
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

    it("nao preenche em atualizacao e aceita o proprio id", async () => {
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

    it("libera admin, campo invalido e ausencia de corpo", async () => {
      expect((await run(authorizeOwnerByBody("id_usuario"), mockRequest({ body: { id_usuario: 2 } }), admin)).next).toHaveBeenCalled();
      expect((await run(authorizeOwnerByBody("id_usuario"), mockRequest({ body: { id_usuario: "x" } }))).next).toHaveBeenCalled();
      expect((await run(authorizeOwnerByBody("id_carrinho", async () => 2), mockRequest({ body: undefined, method: "POST" }))).next).toHaveBeenCalled();
    });

    it("exige autenticacao", async () => {
      const { res } = await run(authorizeOwnerByBody("id_usuario"), mockRequest({ body: {} }), null);
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe("authorizeOwnerByQuery", () => {
    it("cliente so lista filtrando pelo proprio id", async () => {
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
