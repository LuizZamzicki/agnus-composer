import { usuarioExiste } from "@agnus/comum/utils/referencias";
import CarrinhoItensController from "../../src/controllers/carrinhoItens.controller";
import CarrinhosController from "../../src/controllers/carrinhos.controller";
import CarrinhoItens from "../../src/models/CarrinhoItens";
import Carrinhos from "../../src/models/Carrinhos";
import {
  enrichItemsWithProductData,
  normalizeItemQuantity,
  resolveProdutoContext,
  consultarSelecao,
} from "@agnus/comum/utils/itemDetails";
import { buildModelInstance, mockRequest, mockResponse } from "../helpers/http";

jest.mock("@agnus/comum/utils/referencias", () => ({ __esModule: true, usuarioExiste: jest.fn() }));
jest.mock("../../src/models/CarrinhoItens", () => ({
  __esModule: true,
  default: { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn() },
}));
jest.mock("../../src/models/Carrinhos", () => ({
  __esModule: true,
  default: { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn() },
}));
jest.mock("@agnus/comum/utils/itemDetails", () => ({
  __esModule: true,
  enrichItemsWithProductData: jest.fn(async (items) => items ?? []),
  normalizeItemQuantity: jest.fn((value) => {
    const parsedValue = Number(value ?? 1);
    return Number.isFinite(parsedValue) && parsedValue > 0 ? Math.trunc(parsedValue) : 1;
  }),
  resolveProdutoContext: jest.fn(),
  consultarSelecao: jest.fn(),
}));

const carrinhoItensModel = CarrinhoItens as unknown as { findAll: jest.Mock; findByPk: jest.Mock; create: jest.Mock };
const carrinhosModel = Carrinhos as unknown as { findAll: jest.Mock; findByPk: jest.Mock; create: jest.Mock };
const coresModel = { findByPk: jest.fn() };
const gradesModel = { findByPk: jest.fn() };
const usuariosModel = { findByPk: jest.fn() };

beforeEach(() => {
  (consultarSelecao as jest.Mock).mockImplementation(async (cor: number, grade: number) => ({
    cor: await coresModel.findByPk(cor),
    grade: await gradesModel.findByPk(grade),
    contexto: null,
  }));
  (usuarioExiste as jest.Mock).mockImplementation(async (id: number) => Boolean(await usuariosModel.findByPk(id)));
});
const enrichItemsWithProductDataMock = enrichItemsWithProductData as unknown as jest.Mock;
const normalizeItemQuantityMock = normalizeItemQuantity as unknown as jest.Mock;
const resolveProdutoContextMock = resolveProdutoContext as unknown as jest.Mock;

describe("CarrinhosController", () => {
  it("findAll retorna 400 para id_usuario inválido", async () => {
    const response = mockResponse();
    await CarrinhosController.findAll(mockRequest({ query: { id_usuario: "x" } }), response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "id_usuario inválido." });
  });

  it("findAll retorna 200 com lista vazia", async () => {
    const response = mockResponse();
    carrinhosModel.findAll.mockResolvedValueOnce([]);
    await CarrinhosController.findAll(mockRequest({ query: { id_usuario: "1" } }), response);
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.send).toHaveBeenCalledWith([]);
  });

  it("getById retorna 400 para id inválido", async () => {
    const response = mockResponse();
    await CarrinhosController.getById(mockRequest({ params: { id: "x" } }), response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "ID do carrinho inválido." });
  });

  it("getById retorna 404 quando o carrinho não existe", async () => {
    const response = mockResponse();
    carrinhosModel.findByPk.mockResolvedValueOnce(null);
    await CarrinhosController.getById(mockRequest({ params: { id: "1" } }), response);
    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ message: "Carrinho não encontrado." });
  });

  it("getById retorna 200 com o carrinho", async () => {
    const response = mockResponse(), carrinho = buildModelInstance({ id_carrinho: 1, id_usuario: 1 });
    carrinhosModel.findByPk.mockResolvedValueOnce(carrinho);
    await CarrinhosController.getById(mockRequest({ params: { id: "1" } }), response);
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.send).toHaveBeenCalledWith(carrinho);
  });

  it("create retorna 400 sem id_usuario", async () => {
    const response = mockResponse();
    await CarrinhosController.create(mockRequest({ body: {} }), response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "id_usuario e obrigatório." });
  });

  it("create retorna 400 para id_usuario inválido", async () => {
    const response = mockResponse();
    await CarrinhosController.create(mockRequest({ body: { id_usuario: "x" } }), response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "id_usuario inválido." });
  });

  it("create retorna 404 quando o usuário não existe", async () => {
    const response = mockResponse();
    usuariosModel.findByPk.mockResolvedValueOnce(null);
    await CarrinhosController.create(mockRequest({ body: { id_usuario: 1 } }), response);
    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ message: "Usuário não encontrado." });
  });

  it("create retorna 201 com o carrinho criado", async () => {
    const response = mockResponse(), carrinho = buildModelInstance({ id_carrinho: 1, id_usuario: 1 });
    usuariosModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_usuario: 1 }));
    carrinhosModel.create.mockResolvedValueOnce(carrinho);
    await CarrinhosController.create(mockRequest({ body: { id_usuario: 1 } }), response);
    expect(response.status).toHaveBeenCalledWith(201);
    expect(carrinhosModel.create).toHaveBeenCalledWith({ id_usuario: 1 });
    expect(response.send).toHaveBeenCalledWith(carrinho);
  });

  it("update retorna 400 para id inválido", async () => {
    const response = mockResponse();
    await CarrinhosController.update(mockRequest({ params: { id: "x" }, body: {} }), response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "ID do carrinho inválido." });
  });

  it("update retorna 404 quando o carrinho não existe", async () => {
    const response = mockResponse();
    carrinhosModel.findByPk.mockResolvedValueOnce(null);
    await CarrinhosController.update(mockRequest({ params: { id: "1" }, body: {} }), response);
    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ message: "Carrinho não encontrado." });
  });

  it("update retorna 400 para id_usuario inválido", async () => {
    const response = mockResponse(), carrinho = buildModelInstance({ id_carrinho: 1, id_usuario: 1 });
    carrinhosModel.findByPk.mockResolvedValueOnce(carrinho);
    await CarrinhosController.update(mockRequest({ params: { id: "1" }, body: { id_usuario: "x" } }), response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "id_usuario inválido." });
  });

  it("update retorna 404 quando o usuário informado não existe", async () => {
    const response = mockResponse(), carrinho = buildModelInstance({ id_carrinho: 1, id_usuario: 1 });
    carrinhosModel.findByPk.mockResolvedValueOnce(carrinho);
    usuariosModel.findByPk.mockResolvedValueOnce(null);
    await CarrinhosController.update(mockRequest({ params: { id: "1" }, body: { id_usuario: 2 } }), response);
    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ message: "Usuário não encontrado." });
  });

  it("update retorna 200 com o carrinho atualizado", async () => {
    const response = mockResponse(), carrinho = buildModelInstance({ id_carrinho: 1, id_usuario: 1 });
    carrinhosModel.findByPk.mockResolvedValueOnce(carrinho);
    usuariosModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_usuario: 1 }));
    await CarrinhosController.update(mockRequest({ params: { id: "1" }, body: { id_usuario: 1 } }), response);
    expect(carrinho.update).toHaveBeenCalledWith({ id_usuario: 1 });
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.send).toHaveBeenCalledWith(carrinho);
  });

  it("remove retorna 400 para id inválido", async () => {
    const response = mockResponse();
    await CarrinhosController.remove(mockRequest({ params: { id: "x" } }), response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "ID do carrinho inválido." });
  });

  it("remove retorna 404 quando o carrinho não existe", async () => {
    const response = mockResponse();
    carrinhosModel.findByPk.mockResolvedValueOnce(null);
    await CarrinhosController.remove(mockRequest({ params: { id: "1" } }), response);
    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ message: "Carrinho não encontrado." });
  });

  it("remove retorna 204 quando exclui o carrinho", async () => {
    const response = mockResponse(), carrinho = buildModelInstance({ id_carrinho: 1 });
    carrinhosModel.findByPk.mockResolvedValueOnce(carrinho);
    await CarrinhosController.remove(mockRequest({ params: { id: "1" } }), response);
    expect(carrinho.destroy).toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(204);
  });
});

describe("CarrinhoItensController", () => {
  const payload = { id_carrinho: 1, id_produto_cor: 1, id_produto_grade: 1, quantidade: 1, preco_unitario: 10 };

  it("getByIdCart retorna 400 para id inválido", async () => {
    const response = mockResponse();
    await CarrinhoItensController.getByIdCart(mockRequest({ params: { id_cart: "x" } }), response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "ID do carrinho inválido." });
  });

  it("getByIdCart retorna 200 com lista vazia", async () => {
    const response = mockResponse();
    carrinhoItensModel.findAll.mockResolvedValueOnce([]);
    await CarrinhoItensController.getByIdCart(mockRequest({ params: { id_cart: "1" } }), response);
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.send).toHaveBeenCalledWith([]);
  });

  it("create retorna 400 sem campos obrigatórios", async () => {
    const response = mockResponse();
    await CarrinhoItensController.create(mockRequest({ body: {} }), response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "id_carrinho, id_produto_cor e id_produto_grade são obrigatórios." });
  });

  it("create retorna 400 para id_carrinho inválido", async () => {
    const response = mockResponse();
    await CarrinhoItensController.create(mockRequest({ body: { id_carrinho: "x", id_produto_cor: 1, id_produto_grade: 1 } }), response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "id_carrinho inválido." });
  });

  it("create retorna 404 quando o carrinho não existe", async () => {
    const response = mockResponse();
    carrinhosModel.findByPk.mockResolvedValueOnce(null);
    await CarrinhoItensController.create(mockRequest({ body: payload }), response);
    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ message: "Carrinho não encontrado." });
  });

  it("create retorna 404 quando a cor não existe", async () => {
    const response = mockResponse();
    carrinhosModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_carrinho: 1 }));
    coresModel.findByPk.mockResolvedValueOnce(null);
    await CarrinhoItensController.create(mockRequest({ body: payload }), response);
    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ message: "Cor do produto não encontrada." });
  });

  it("create retorna 404 quando a grade não existe", async () => {
    const response = mockResponse();
    carrinhosModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_carrinho: 1 }));
    coresModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_produto_cor: 1, id_produto: 5 }));
    gradesModel.findByPk.mockResolvedValueOnce(null);
    await CarrinhoItensController.create(mockRequest({ body: payload }), response);
    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ message: "Grade do produto não encontrada." });
  });

  it("create retorna 400 quando cor e grade não pertencem ao mesmo produto", async () => {
    const response = mockResponse();
    carrinhosModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_carrinho: 1 }));
    coresModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_produto_cor: 1, id_produto: 5 }));
    gradesModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_produto_grade: 1, id_produto: 6 }));
    await CarrinhoItensController.create(mockRequest({ body: payload }), response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "A cor e a grade informadas não pertencem ao mesmo produto." });
  });

  it("create retorna 201 com o item criado", async () => {
    const response = mockResponse(), item = buildModelInstance({ id_carrinho_item: 1, id_carrinho: 1, id_produto_cor: 1, id_produto_grade: 1, quantidade: 1, preco_unitario: 10 });
    carrinhosModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_carrinho: 1 }));
    coresModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_produto_cor: 1, id_produto: 5 }));
    gradesModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_produto_grade: 1, id_produto: 5 }));
    resolveProdutoContextMock.mockResolvedValueOnce({ precoUnitario: 10 });
    enrichItemsWithProductDataMock.mockResolvedValueOnce([item]);
    carrinhoItensModel.create.mockResolvedValueOnce(item);
    await CarrinhoItensController.create(mockRequest({ body: payload }), response);
    expect(response.status).toHaveBeenCalledWith(201);
    expect(carrinhoItensModel.create).toHaveBeenCalledWith({
      id_carrinho: 1,
      id_produto_cor: 1,
      id_produto_grade: 1,
      quantidade: 1,
      preco_unitario: 10,
    });
    expect(response.send).toHaveBeenCalledWith(item);
  });

  it("update retorna 400 para id inválido", async () => {
    const response = mockResponse();
    await CarrinhoItensController.update(mockRequest({ params: { id: "x" }, body: {} }), response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "ID do item inválido." });
  });

  it("update retorna 404 quando o item não existe", async () => {
    const response = mockResponse();
    carrinhoItensModel.findByPk.mockResolvedValueOnce(null);
    await CarrinhoItensController.update(mockRequest({ params: { id: "1" }, body: {} }), response);
    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ message: "Item do carrinho não encontrado." });
  });

  it("update retorna 404 quando o carrinho informado não existe", async () => {
    const response = mockResponse(), item = buildModelInstance({ id_carrinho_item: 1, id_carrinho: 1, id_produto_cor: 1, id_produto_grade: 1, quantidade: 1, preco_unitario: 10 });
    carrinhoItensModel.findByPk.mockResolvedValueOnce(item);
    carrinhosModel.findByPk.mockResolvedValueOnce(null);
    await CarrinhoItensController.update(mockRequest({ params: { id: "1" }, body: { id_carrinho: 2 } }), response);
    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ message: "Carrinho não encontrado." });
  });

  it("update retorna 404 quando a cor informada não existe", async () => {
    const response = mockResponse(), item = buildModelInstance({ id_carrinho_item: 1, id_carrinho: 1, id_produto_cor: 1, id_produto_grade: 1, quantidade: 1, preco_unitario: 10 });
    carrinhoItensModel.findByPk.mockResolvedValueOnce(item);
    coresModel.findByPk.mockResolvedValueOnce(null);
    await CarrinhoItensController.update(mockRequest({ params: { id: "1" }, body: { id_produto_cor: 2 } }), response);
    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ message: "Cor do produto não encontrada." });
  });

  it("update retorna 404 quando a grade informada não existe", async () => {
    const response = mockResponse(), item = buildModelInstance({ id_carrinho_item: 1, id_carrinho: 1, id_produto_cor: 1, id_produto_grade: 1, quantidade: 1, preco_unitario: 10 });
    carrinhoItensModel.findByPk.mockResolvedValueOnce(item);
    coresModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_produto_cor: 1, id_produto: 5 }));
    gradesModel.findByPk.mockResolvedValueOnce(null);
    await CarrinhoItensController.update(mockRequest({ params: { id: "1" }, body: { id_produto_grade: 3 } }), response);
    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ message: "Grade do produto não encontrada." });
  });

  it("update retorna 400 quando cor e grade não pertencem ao mesmo produto", async () => {
    const response = mockResponse(), item = buildModelInstance({ id_carrinho_item: 1, id_carrinho: 1, id_produto_cor: 1, id_produto_grade: 1, quantidade: 1, preco_unitario: 10 });
    carrinhoItensModel.findByPk.mockResolvedValueOnce(item);
    coresModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_produto_cor: 2, id_produto: 5 }));
    gradesModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_produto_grade: 3, id_produto: 6 }));
    await CarrinhoItensController.update(mockRequest({ params: { id: "1" }, body: { id_produto_cor: 2, id_produto_grade: 3 } }), response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "A cor e a grade informadas não pertencem ao mesmo produto." });
  });

  it("update retorna 400 para id_produto_cor inválido", async () => {
    const response = mockResponse(), item = buildModelInstance({ id_carrinho_item: 1, id_carrinho: 1, id_produto_cor: 1, id_produto_grade: 1, quantidade: 1, preco_unitario: 10 });
    carrinhoItensModel.findByPk.mockResolvedValueOnce(item);
    await CarrinhoItensController.update(mockRequest({ params: { id: "1" }, body: { id_produto_cor: "x" } }), response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "id_produto_cor inválido." });
  });

  it("update retorna 200 com o item atualizado", async () => {
    const response = mockResponse(), item = buildModelInstance({ id_carrinho_item: 1, id_carrinho: 1, id_produto_cor: 1, id_produto_grade: 1, quantidade: 1, preco_unitario: 10 });
    carrinhoItensModel.findByPk.mockResolvedValueOnce(item);
    carrinhosModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_carrinho: 1 }));
    coresModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_produto_cor: 2, id_produto: 5 }));
    gradesModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_produto_grade: 3, id_produto: 5 }));
    coresModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_produto_cor: 2, id_produto: 5 }));
    gradesModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_produto_grade: 3, id_produto: 5 }));
    resolveProdutoContextMock.mockResolvedValueOnce({ precoUnitario: 10 });
    enrichItemsWithProductDataMock.mockResolvedValueOnce([item]);
    await CarrinhoItensController.update(
      mockRequest({ params: { id: "1" }, body: { id_carrinho: 1, id_produto_cor: 2, id_produto_grade: 3, quantidade: 2 } }),
      response,
    );
    expect(item.update).toHaveBeenCalledWith({
      id_carrinho: 1,
      id_produto_cor: 2,
      id_produto_grade: 3,
      quantidade: 2,
      preco_unitario: 10,
    });
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.send).toHaveBeenCalledWith(item);
    expect(normalizeItemQuantityMock).toHaveBeenCalled();
  });

  it("remove retorna 400 para id inválido", async () => {
    const response = mockResponse();
    await CarrinhoItensController.remove(mockRequest({ params: { id: "x" } }), response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "ID do item inválido." });
  });

  it("remove retorna 404 quando o item não existe", async () => {
    const response = mockResponse();
    carrinhoItensModel.findByPk.mockResolvedValueOnce(null);
    await CarrinhoItensController.remove(mockRequest({ params: { id: "1" } }), response);
    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ message: "Item do carrinho não encontrado." });
  });

  it("remove retorna 204 quando exclui o item", async () => {
    const response = mockResponse(), item = buildModelInstance({ id_carrinho_item: 1 });
    carrinhoItensModel.findByPk.mockResolvedValueOnce(item);
    await CarrinhoItensController.remove(mockRequest({ params: { id: "1" } }), response);
    expect(item.destroy).toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(204);
  });
});
