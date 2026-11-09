import { chamarServico } from "@agnus/comum/utils/clienteInterno";
import EventBusService from "@agnus/comum/services/eventBus.service";
import ProdutosController from "../../src/controllers/produtos.controller";
import sequelize from "@agnus/comum/config/database";
import Categorias from "../../src/models/Categorias";
import ProdutoCores from "../../src/models/ProdutoCores";
import ProdutoFotos from "../../src/models/ProdutoFotos";
import ProdutoGrades from "../../src/models/ProdutoGrades";
import Produtos from "../../src/models/Produtos";
import { buildModelInstance, mockRequest, mockResponse } from "../helpers/http";

jest.mock("@agnus/comum/config/database", () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
    transaction: jest.fn(async (handler: (tx: object) => Promise<unknown>) => handler({})),
  },
}));
jest.mock("../../src/models/Categorias", () => ({
  __esModule: true,
  default: { findByPk: jest.fn() },
}));
jest.mock("../../src/models/ProdutoVendas", () => ({ __esModule: true, default: { destroy: jest.fn() } }));
jest.mock("../../src/models/ProdutoCores", () => ({
  __esModule: true,
  default: { create: jest.fn(), destroy: jest.fn(), findAll: jest.fn() },
}));
jest.mock("../../src/models/ProdutoFotos", () => ({
  __esModule: true,
  default: { create: jest.fn(), destroy: jest.fn() },
}));
jest.mock("../../src/models/ProdutoGrades", () => ({
  __esModule: true,
  default: { create: jest.fn(), destroy: jest.fn(), findAll: jest.fn() },
}));
jest.mock("../../src/models/Produtos", () => ({
  __esModule: true,
  default: { findAndCountAll: jest.fn(), findByPk: jest.fn(), create: jest.fn() },
}));
jest.mock("@agnus/comum/utils/clienteInterno", () => ({ __esModule: true, chamarServico: jest.fn() }));
jest.mock("@agnus/comum/services/eventBus.service", () => ({ __esModule: true, default: { publish: jest.fn() } }));

const db = sequelize as unknown as { query: jest.Mock; transaction: jest.Mock };
const categoriasModel = Categorias as unknown as { findByPk: jest.Mock };
const coresModel = ProdutoCores as unknown as { create: jest.Mock; destroy: jest.Mock; findAll: jest.Mock };
const fotosModel = ProdutoFotos as unknown as { create: jest.Mock; destroy: jest.Mock };
const gradesModel = ProdutoGrades as unknown as { create: jest.Mock; destroy: jest.Mock; findAll: jest.Mock };
const produtosModel = Produtos as unknown as { findAndCountAll: jest.Mock; findByPk: jest.Mock; create: jest.Mock };

describe("ProdutosController", () => {
  beforeEach(() => {
    db.query.mockReset();
    db.transaction.mockReset();
    db.transaction.mockImplementation(async (handler: (tx: object) => Promise<unknown>) => handler({}));
    categoriasModel.findByPk.mockReset();
    coresModel.create.mockReset();
    coresModel.destroy.mockReset();
    coresModel.findAll.mockReset();
    fotosModel.create.mockReset();
    fotosModel.destroy.mockReset();
    gradesModel.create.mockReset();
    gradesModel.destroy.mockReset();
    gradesModel.findAll.mockReset();
    produtosModel.findAndCountAll.mockReset();
    produtosModel.findByPk.mockReset();
    produtosModel.create.mockReset();
  });

  it("findAll retorna 200 para categoria null", async () => {
    const response = mockResponse();
    produtosModel.findAndCountAll.mockResolvedValueOnce({ count: 1, rows: [{ id_produto: 2 }] });
    await ProdutosController.findAll(mockRequest({ query: { id_categoria: "null" } }), response);
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      data: [{ id_produto: 2 }],
      pagination: expect.objectContaining({ page: 1, limit: 10, total: 1 }),
    });
  });

  it("findAll e getById escondem custo e margem de quem não e da equipe", async () => {
    produtosModel.findAndCountAll.mockResolvedValueOnce({ count: 0, rows: [] });
    produtosModel.findByPk.mockResolvedValueOnce({ id_produto: 2 });
    await ProdutosController.findAll(mockRequest({ query: {} }), mockResponse());
    await ProdutosController.getById(mockRequest({ params: { id: "2" } }), mockResponse());
    const oculto = { exclude: ["preco_custo", "margem_lucro"] };
    expect(produtosModel.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({ attributes: oculto }));
    expect(produtosModel.findByPk).toHaveBeenCalledWith(2, { attributes: oculto });
  });

  it("findAll e getById mostram custo e margem para administrador", async () => {
    const response = mockResponse();
    response.locals.authUser = { id_usuario: 1, email: "a@a.com", tipo: "administrador" };
    produtosModel.findAndCountAll.mockResolvedValueOnce({ count: 0, rows: [] });
    produtosModel.findByPk.mockResolvedValueOnce({ id_produto: 2 });
    await ProdutosController.findAll(mockRequest({ query: {} }), response);
    await ProdutosController.getById(mockRequest({ params: { id: "2" } }), response);
    expect(produtosModel.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({ attributes: undefined }));
    expect(produtosModel.findByPk).toHaveBeenCalledWith(2, { attributes: undefined });
  });

  it("findAll retorna 400 para categoria inválida", async () => {
    const response = mockResponse();
    await ProdutosController.findAll(mockRequest({ query: { id_categoria: "x" } }), response);
    expect(response.status).toHaveBeenCalledWith(400);
  });

  it("findAll retorna 200 para categoria numerica e ativo", async () => {
    const response = mockResponse();
    produtosModel.findAndCountAll.mockResolvedValueOnce({ count: 1, rows: [{ id_produto: 1 }] });
    await ProdutosController.findAll(mockRequest({ query: { id_categoria: "1", ativo: "true" } }), response);
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it("catalog retorna 400 para categoria inválida", async () => {
    const response = mockResponse();
    await ProdutosController.catalog(mockRequest({ query: { id_categoria: "x" } }), response);
    expect(response.status).toHaveBeenCalledWith(400);
  });

  it("catalog retorna 200 com imagens parseadas para categoria null", async () => {
    const response = mockResponse();
    db.query.mockResolvedValueOnce([{ total: 1 }]).mockResolvedValueOnce([{ id_produto: 1, imagens_json: "[\"a.jpg\"]" }]);
    await ProdutosController.catalog(mockRequest({ query: { id_categoria: "null", ativo: "false" } }), response);
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      data: [expect.objectContaining({ id_produto: 1, imagens: ["a.jpg"], imagens_json: undefined })],
      pagination: expect.objectContaining({ page: 1, limit: 10, total: 1 }),
    });
  });

  it("catalog retorna 200 para categoria numerica", async () => {
    const response = mockResponse();
    db.query.mockResolvedValueOnce([{ total: 1 }]).mockResolvedValueOnce([{ id_produto: 2, imagens_json: "[]" }]);
    await ProdutosController.catalog(mockRequest({ query: { id_categoria: "2" } }), response);
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it("findAll retorna 503 quando a busca no indice esta indisponível", async () => {
    const response = mockResponse();
    await ProdutosController.findAll(mockRequest({ query: { q: "camizeta" } }), response);
    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.json).toHaveBeenCalledWith({ message: "Busca indisponível no momento." });
  });

  it("catalog retorna 503 quando a busca no indice esta indisponível", async () => {
    const response = mockResponse();
    await ProdutosController.catalog(mockRequest({ query: { q: "camisa" } }), response);
    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.json).toHaveBeenCalledWith({ message: "Busca indisponível no momento." });
  });

  it("catalog usa o indice quando a busca responde", async () => {
    const response = mockResponse();
    (chamarServico as jest.Mock).mockResolvedValueOnce({ status: 200, data: {
      data: [{ id_produto: 9, id_categoria: 1, nome: "Camiseta Dry Fit", descricao: "treino", preco_base: 59.9, ativo: true, categoria_nome: "Roupas", quantidade_vendida: 15, imagens: ["x.jpg"] }],
      total: 1,
    } });
    await ProdutosController.catalog(mockRequest({ query: { q: "camiseta" } }), response);
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      data: [expect.objectContaining({ id_produto: 9, imagens: ["x.jpg"] })],
      pagination: expect.objectContaining({ page: 1, limit: 10, total: 1 }),
    });
  });

  it("getById retorna 404 quando o produto não existe", async () => {
    const response = mockResponse();
    produtosModel.findByPk.mockResolvedValueOnce(null);
    await ProdutosController.getById(mockRequest({ params: { id: "1" } }), response);
    expect(response.status).toHaveBeenCalledWith(404);
  });

  it("getById retorna 200 com o produto", async () => {
    const response = mockResponse(), produto = buildModelInstance({ id_produto: 1, nome: "A" });
    produtosModel.findByPk.mockResolvedValueOnce(produto);
    await ProdutosController.getById(mockRequest({ params: { id: "1" } }), response);
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it("create retorna 400 sem body válido", async () => {
    const response = mockResponse();
    await ProdutosController.create(mockRequest({ body: {} }), response);
    expect(response.status).toHaveBeenCalledWith(400);
  });

  it("create retorna 400 sem nenhuma grade", async () => {
    const response = mockResponse();
    await ProdutosController.create(mockRequest({ body: { nome: "A", preco_base: 10, cores: [{ nome: "Azul", tonalidade: "#00F", fotos: ["a.jpg"] }] } }), response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "O produto precisa ter pelo menos uma grade." });
  });

  it("create retorna 400 sem cor com foto", async () => {
    const response = mockResponse();
    await ProdutosController.create(mockRequest({ body: { nome: "A", preco_base: 10, grades: [{ nome: "M" }], cores: [{ nome: "Azul", tonalidade: "#00F" }] } }), response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "O produto precisa ter pelo menos uma cor com foto." });
  });

  it("create retorna 400 para preco_custo inválido", async () => {
    const response = mockResponse();
    await ProdutosController.create(mockRequest({ body: { nome: "A", preco_base: 10, preco_custo: "x" } }), response);
    expect(response.status).toHaveBeenCalledWith(400);
  });

  it("create retorna 400 para categoria inválida", async () => {
    const response = mockResponse();
    await ProdutosController.create(mockRequest({ body: { nome: "A", preco_base: 10, id_categoria: "abc" } }), response);
    expect(response.status).toHaveBeenCalledWith(400);
  });

  it("create retorna 400 para grades inválidas", async () => {
    const response = mockResponse();
    await ProdutosController.create(mockRequest({ body: { nome: "A", preco_base: 10, grades: "x" } }), response);
    expect(response.status).toHaveBeenCalledWith(400);
  });

  it("create retorna 400 para cores inválidas", async () => {
    const response = mockResponse();
    await ProdutosController.create(mockRequest({ body: { nome: "A", preco_base: 10, grades: [], cores: "x" } }), response);
    expect(response.status).toHaveBeenCalledWith(400);
  });

  it("create retorna 404 quando a categoria não existe", async () => {
    const response = mockResponse();
    categoriasModel.findByPk.mockResolvedValueOnce(null);
    await ProdutosController.create(
      mockRequest({ body: { nome: "A", preco_base: 10, id_categoria: 9, grades: [{ nome: "M" }], cores: [{ nome: "Azul", tonalidade: "#00F", fotos: ["a.jpg"] }] } }),
      response,
    );
    expect(response.status).toHaveBeenCalledWith(404);
  });

  it("create retorna 201 com grades, cores e fotos", async () => {
    const response = mockResponse(), produto = buildModelInstance({ id_produto: 10, nome: "A", descricao: null, preco_custo: 1, preco_base: 2, ativo: true });
    produtosModel.create.mockResolvedValueOnce(produto);
    gradesModel.create.mockResolvedValueOnce(buildModelInstance({ id_produto_grade: 1, id_produto: 10, nome: "M", acrescimo: 1 }));
    coresModel.create.mockResolvedValueOnce(buildModelInstance({ id_produto_cor: 2, id_produto: 10, nome: "Azul", codigo_rgb: "#00F", acrescimo: 2 }));
    fotosModel.create.mockResolvedValueOnce(buildModelInstance({ id_produto_foto: 3, id_produto: 10, id_produto_cor: 2, caminho_url: "a.jpg" }));
    await ProdutosController.create(
      mockRequest({ body: { nome: "A", preco_base: 20, preco_custo: 10, grades: [{ nome: "M", acrescimo: 1 }], cores: [{ nome: "Azul", tonalidade: "#00F", acrescimo: 2, fotos: ["a.jpg"] }] } }),
      response,
    );
    expect(response.status).toHaveBeenCalledWith(201);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ id_produto: 10 }));
  });

  it("create retorna 400 para grade sem nome", async () => {
    const response = mockResponse();
    await ProdutosController.create(mockRequest({ body: { nome: "A", preco_base: 20, grades: [{ nome: "" }], cores: [] } }), response);
    expect(response.status).toHaveBeenCalledWith(400);
  });

  it("create retorna 400 para acréscimo de grade inválido", async () => {
    const response = mockResponse();
    await ProdutosController.create(mockRequest({ body: { nome: "A", preco_base: 20, grades: [{ nome: "M", acrescimo: "x" }], cores: [] } }), response);
    expect(response.status).toHaveBeenCalledWith(400);
  });

  it("create retorna 400 para cor sem nome", async () => {
    const response = mockResponse();
    await ProdutosController.create(mockRequest({ body: { nome: "A", preco_base: 20, grades: [], cores: [{ nome: "", fotos: [] }] } }), response);
    expect(response.status).toHaveBeenCalledWith(400);
  });

  it("create retorna 400 para acréscimo de cor inválido", async () => {
    const response = mockResponse();
    await ProdutosController.create(mockRequest({ body: { nome: "A", preco_base: 20, grades: [], cores: [{ nome: "Azul", codigo_rgb: "#00F", acrescimo: "x", fotos: [] }] } }), response);
    expect(response.status).toHaveBeenCalledWith(400);
  });

  it("create retorna 400 para fotos que não são array", async () => {
    const response = mockResponse(), produto = buildModelInstance({ id_produto: 11, nome: "A", descricao: null, preco_custo: 1, preco_base: 2, ativo: true });
    produtosModel.create.mockResolvedValueOnce(produto);
    coresModel.create.mockResolvedValueOnce(buildModelInstance({ id_produto_cor: 20, id_produto: 11, nome: "Azul", codigo_rgb: "#00F", acrescimo: 1 }));
    await ProdutosController.create(mockRequest({ body: { nome: "A", preco_base: 20, grades: [], cores: [{ nome: "Azul", codigo_rgb: "#00F", acrescimo: 1, fotos: "x" }] } }), response);
    expect(response.status).toHaveBeenCalledWith(400);
  });

  it("create retorna 400 para item de foto inválido", async () => {
    const response = mockResponse(), produto = buildModelInstance({ id_produto: 12, nome: "A", descricao: null, preco_custo: 1, preco_base: 2, ativo: true });
    produtosModel.create.mockResolvedValueOnce(produto);
    coresModel.create.mockResolvedValueOnce(buildModelInstance({ id_produto_cor: 21, id_produto: 12, nome: "Azul", codigo_rgb: "#00F", acrescimo: 1 }));
    await ProdutosController.create(mockRequest({ body: { nome: "A", preco_base: 20, grades: [], cores: [{ nome: "Azul", codigo_rgb: "#00F", acrescimo: 1, fotos: [{}] }] } }), response);
    expect(response.status).toHaveBeenCalledWith(400);
  });

  it("update retorna 404 quando o produto não existe", async () => {
    const response = mockResponse();
    produtosModel.findByPk.mockResolvedValueOnce(null);
    await ProdutosController.update(mockRequest({ params: { id: "1" }, body: {} }), response);
    expect(response.status).toHaveBeenCalledWith(404);
  });

  it("update retorna 400 para categoria inválida", async () => {
    const response = mockResponse(), produto = buildModelInstance({ id_produto: 1, id_categoria: 1, nome: "A", descricao: "d", preco_custo: 1, preco_base: 2, ativo: true });
    produtosModel.findByPk.mockResolvedValueOnce(produto);
    await ProdutosController.update(mockRequest({ params: { id: "1" }, body: { id_categoria: "abc" } }), response);
    expect(response.status).toHaveBeenCalledWith(400);
  });

  it("update retorna 404 quando a categoria não existe", async () => {
    const response = mockResponse(), produto = buildModelInstance({ id_produto: 1, id_categoria: 1, nome: "A", descricao: "d", preco_custo: 1, preco_base: 2, ativo: true });
    produtosModel.findByPk.mockResolvedValueOnce(produto);
    categoriasModel.findByPk.mockResolvedValueOnce(null);
    await ProdutosController.update(mockRequest({ params: { id: "1" }, body: { id_categoria: 9 } }), response);
    expect(response.status).toHaveBeenCalledWith(404);
  });

  it("update retorna 400 quando grades fica vazio", async () => {
    const response = mockResponse(), produto = buildModelInstance({ id_produto: 1, id_categoria: 1, nome: "A", descricao: "d", preco_custo: 1, preco_base: 2, ativo: true });
    produtosModel.findByPk.mockResolvedValueOnce(produto);
    await ProdutosController.update(mockRequest({ params: { id: "1" }, body: { grades: [] } }), response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "O produto precisa ter pelo menos uma grade." });
  });

  it("update retorna 400 quando cores fica sem foto", async () => {
    const response = mockResponse(), produto = buildModelInstance({ id_produto: 1, id_categoria: 1, nome: "A", descricao: "d", preco_custo: 1, preco_base: 2, ativo: true });
    produtosModel.findByPk.mockResolvedValueOnce(produto);
    await ProdutosController.update(mockRequest({ params: { id: "1" }, body: { cores: [{ nome: "Azul", tonalidade: "#00F" }] } }), response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "O produto precisa ter pelo menos uma cor com foto." });
  });

  it("update retorna 200 com o produto atualizado", async () => {
    const response = mockResponse(), produto = buildModelInstance({ id_produto: 1, id_categoria: 1, nome: "A", descricao: "d", preco_custo: 1, preco_base: 2, ativo: true });
    produtosModel.findByPk.mockResolvedValueOnce(produto);
    categoriasModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_categoria: 1 }));
    await ProdutosController.update(mockRequest({ params: { id: "1" }, body: { id_categoria: 1, nome: "B", ativo: false } }), response);
    expect(produto.update).toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it("update sincroniza grades, cores e fotos", async () => {
    const response = mockResponse(), produto = buildModelInstance({ id_produto: 1, id_categoria: 1, nome: "A", descricao: "d", preco_custo: 1, preco_base: 2, ativo: true });
    gradesModel.destroy.mockResolvedValueOnce(2);
    fotosModel.destroy.mockResolvedValueOnce(3);
    coresModel.destroy.mockResolvedValueOnce(2);
    gradesModel.create.mockResolvedValueOnce(buildModelInstance({ id_produto_grade: 10, id_produto: 1, nome: "M", acrescimo: 1 }));
    coresModel.create.mockResolvedValueOnce(buildModelInstance({ id_produto_cor: 20, id_produto: 1, nome: "Azul", codigo_rgb: "#00F", acrescimo: 1 }));
    fotosModel.create.mockResolvedValueOnce(buildModelInstance({ id_produto_foto: 30, id_produto: 1, id_produto_cor: 20, caminho_url: "a.jpg" }));
    produtosModel.findByPk.mockResolvedValueOnce(produto);
    categoriasModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_categoria: 1 }));
    await ProdutosController.update(
      mockRequest({ params: { id: "1" }, body: { id_categoria: 1, nome: "Novo", grades: [{ nome: "M", acrescimo: 1 }], cores: [{ nome: "Azul", tonalidade: "#00F", acrescimo: 1, fotos: ["a.jpg"] }] } }),
      response,
    );
    expect(gradesModel.destroy).toHaveBeenCalled();
    expect(coresModel.destroy).toHaveBeenCalled();
    expect(fotosModel.destroy).toHaveBeenCalled();
    expect(gradesModel.create).toHaveBeenCalled();
    expect(coresModel.create).toHaveBeenCalled();
    expect(fotosModel.create).toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it("remove retorna 409 quando há pedidos com o produto", async () => {
    const response = mockResponse(), produto = buildModelInstance({ id_produto: 1 });
    produtosModel.findByPk.mockResolvedValueOnce(produto);
    coresModel.findAll.mockResolvedValueOnce([{ id_produto_cor: 2 }]);
    gradesModel.findAll.mockResolvedValueOnce([]);
    (chamarServico as jest.Mock).mockResolvedValueOnce({ status: 200, data: { total: 1 } });
    await ProdutosController.remove(mockRequest({ params: { id: "1" } }), response);
    expect(produto.destroy).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(409);
  });

  it("remove retorna 404 quando o produto não existe", async () => {
    const response = mockResponse();
    produtosModel.findByPk.mockResolvedValueOnce(null);
    await ProdutosController.remove(mockRequest({ params: { id: "1" } }), response);
    expect(response.status).toHaveBeenCalledWith(404);
  });

  it("remove retorna 204 quando exclui o produto", async () => {
    const response = mockResponse(), produto = buildModelInstance({ id_produto: 1 });
    produtosModel.findByPk.mockResolvedValueOnce(produto);
    coresModel.findAll.mockResolvedValueOnce([]);
    gradesModel.findAll.mockResolvedValueOnce([]);
    (chamarServico as jest.Mock).mockResolvedValueOnce({ status: 200, data: { total: 0 } });
    await ProdutosController.remove(mockRequest({ params: { id: "1" } }), response);
    expect(produto.destroy).toHaveBeenCalled();
    expect(fotosModel.destroy).toHaveBeenCalled();
    expect(EventBusService.publish).toHaveBeenCalledWith("produto.removido", { id_produto: 1, cores: [], grades: [] });
    expect(response.status).toHaveBeenCalledWith(204);
  });
});
