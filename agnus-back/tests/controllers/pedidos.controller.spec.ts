import PedidoItensController from "../../src/controllers/pedidoItens.controller";
import PedidosController from "../../src/controllers/pedidos.controller";
import PedidoItens from "../../src/models/PedidoItens";
import Pedidos from "../../src/models/Pedidos";
import ProdutoCores from "../../src/models/ProdutoCores";
import ProdutoGrades from "../../src/models/ProdutoGrades";
import {
  calculateSubtotal,
  enrichItemsWithProductData,
  normalizeItemQuantity,
  resolveProdutoContext,
} from "../../src/utils/itemDetails";
import UsuarioEnderecos from "../../src/models/UsuarioEnderecos";
import Usuarios from "../../src/models/Usuarios";
import CheckoutService, { CheckoutError } from "../../src/services/checkout.service";
import { buildModelInstance, mockRequest, mockResponse } from "../helpers/http";

jest.mock("../../src/services/checkout.service", () => {
  class CheckoutError extends Error {
    constructor(readonly status: number, message: string) {
      super(message);
    }
  }

  return { __esModule: true, CheckoutError, default: { finalizar: jest.fn() } };
});
jest.mock("../../src/models/PedidoItens", () => ({
  __esModule: true,
  default: { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn() },
}));
jest.mock("../../src/models/Pedidos", () => ({
  __esModule: true,
  default: { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn() },
}));
jest.mock("../../src/models/ProdutoCores", () => ({
  __esModule: true,
  default: { findByPk: jest.fn() },
}));
jest.mock("../../src/models/ProdutoGrades", () => ({
  __esModule: true,
  default: { findByPk: jest.fn() },
}));
jest.mock("../../src/models/UsuarioEnderecos", () => ({
  __esModule: true,
  default: { findByPk: jest.fn() },
}));
jest.mock("../../src/models/Usuarios", () => ({
  __esModule: true,
  default: { findByPk: jest.fn() },
}));
jest.mock("../../src/utils/itemDetails", () => ({
  __esModule: true,
  calculateSubtotal: jest.fn((precoUnitario, quantidade) => Number(precoUnitario) * Number(quantidade)),
  enrichItemsWithProductData: jest.fn(async (items) => items ?? []),
  normalizeItemQuantity: jest.fn((value) => {
    const parsedValue = Number(value ?? 1);
    return Number.isFinite(parsedValue) && parsedValue > 0 ? Math.trunc(parsedValue) : 1;
  }),
  resolveProdutoContext: jest.fn(),
}));

const pedidoItensModel = PedidoItens as unknown as { findAll: jest.Mock; findByPk: jest.Mock; create: jest.Mock };
const pedidosModel = Pedidos as unknown as { findAll: jest.Mock; findByPk: jest.Mock; create: jest.Mock };
const coresModel = ProdutoCores as unknown as { findByPk: jest.Mock };
const gradesModel = ProdutoGrades as unknown as { findByPk: jest.Mock };
const enderecosModel = UsuarioEnderecos as unknown as { findByPk: jest.Mock };
const usuariosModel = Usuarios as unknown as { findByPk: jest.Mock };
const calculateSubtotalMock = calculateSubtotal as unknown as jest.Mock;
const enrichItemsWithProductDataMock = enrichItemsWithProductData as unknown as jest.Mock;
const normalizeItemQuantityMock = normalizeItemQuantity as unknown as jest.Mock;
const resolveProdutoContextMock = resolveProdutoContext as unknown as jest.Mock;

describe("PedidosController", () => {
  const payload = { id_usuario: 1, id_usuario_endereco: 1, status: "aguardando_pagamento", valor_total: 20, valor_frete: 5 };

  it("findAll retorna 400 para id_usuario invalido", async () => {
    const response = mockResponse();
    await PedidosController.findAll(mockRequest({ query: { id_usuario: "x" } }), response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "id_usuario invalido." });
  });

  it("findAll retorna 400 para status invalido", async () => {
    const response = mockResponse();
    await PedidosController.findAll(mockRequest({ query: { status: "foo" } }), response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "status invalido." });
  });

  it("findAll retorna 200 com lista vazia", async () => {
    const response = mockResponse();
    pedidosModel.findAll.mockResolvedValueOnce([]);
    await PedidosController.findAll(mockRequest({ query: { id_usuario: "1", status: "pago" } }), response);
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.send).toHaveBeenCalledWith([]);
  });

  it("findMine lista so os pedidos do usuario do token, ignorando id_usuario da query", async () => {
    const response = mockResponse();
    response.locals = { authUser: { id_usuario: 7, email: "c@a.com", tipo: "cliente" } };
    pedidosModel.findAll.mockResolvedValueOnce([{ id_pedido: 1, id_usuario: 7 }]);

    await PedidosController.findMine(mockRequest({ query: { id_usuario: "99", status: "entregue" } }), response);

    expect(pedidosModel.findAll).toHaveBeenLastCalledWith({
      where: { id_usuario: 7, status: "entregue" },
      order: [["data_criacao", "DESC"]],
    });
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.send).toHaveBeenCalledWith([{ id_pedido: 1, id_usuario: 7 }]);
  });

  it("findMine retorna 400 para status invalido", async () => {
    const response = mockResponse();
    response.locals = { authUser: { id_usuario: 7, email: "c@a.com", tipo: "cliente" } };
    await PedidosController.findMine(mockRequest({ query: { status: "foo" } }), response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "status invalido." });
  });

  it("getById retorna 400 para id invalido", async () => {
    const response = mockResponse();
    await PedidosController.getById(mockRequest({ params: { id: "x" } }), response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "ID do pedido invalido." });
  });

  it("getById retorna 404 quando o pedido nao existe", async () => {
    const response = mockResponse();
    pedidosModel.findByPk.mockResolvedValueOnce(null);
    await PedidosController.getById(mockRequest({ params: { id: "1" } }), response);
    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ message: "Pedido nao encontrado." });
  });

  it("getById retorna 200 com o pedido", async () => {
    const response = mockResponse(), pedido = buildModelInstance({ id_pedido: 1, id_usuario: 1, id_usuario_endereco: 1, status: "pago", valor_total: 10, valor_frete: 2 });
    pedidosModel.findByPk.mockResolvedValueOnce(pedido);
    await PedidosController.getById(mockRequest({ params: { id: "1" } }), response);
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.send).toHaveBeenCalledWith(pedido);
  });

  it("create retorna 400 sem campos obrigatorios", async () => {
    const response = mockResponse();
    await PedidosController.create(mockRequest({ body: {} }), response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "id_usuario e id_usuario_endereco sao obrigatorios." });
  });

  it("create retorna 400 para id_usuario invalido", async () => {
    const response = mockResponse();
    await PedidosController.create(mockRequest({ body: { id_usuario: "x", id_usuario_endereco: 1 } }), response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "id_usuario invalido." });
  });

  it("create retorna 400 para status invalido", async () => {
    const response = mockResponse();
    await PedidosController.create(mockRequest({ body: { id_usuario: 1, id_usuario_endereco: 1, status: "x" } }), response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "status invalido." });
  });

  it("create retorna 404 quando o usuario nao existe", async () => {
    const response = mockResponse();
    usuariosModel.findByPk.mockResolvedValueOnce(null);
    await PedidosController.create(mockRequest({ body: payload }), response);
    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ message: "Usuario nao encontrado." });
  });

  it("create retorna 404 quando o endereco nao existe", async () => {
    const response = mockResponse();
    usuariosModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_usuario: 1 }));
    enderecosModel.findByPk.mockResolvedValueOnce(null);
    await PedidosController.create(mockRequest({ body: payload }), response);
    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ message: "Endereco do usuario nao encontrado." });
  });

  it("create retorna 400 quando o endereco nao pertence ao usuario", async () => {
    const response = mockResponse();
    usuariosModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_usuario: 1 }));
    enderecosModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_usuario_endereco: 1, id_usuario: 2 }));
    await PedidosController.create(mockRequest({ body: payload }), response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "O endereco informado nao pertence ao usuario informado." });
  });

  it("create retorna 201 com o pedido criado", async () => {
    const response = mockResponse(), pedido = buildModelInstance({ id_pedido: 1, ...payload });
    usuariosModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_usuario: 1 }));
    enderecosModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_usuario_endereco: 1, id_usuario: 1 }));
    pedidosModel.create.mockResolvedValueOnce(pedido);
    await PedidosController.create(mockRequest({ body: payload }), response);
    expect(response.status).toHaveBeenCalledWith(201);
    // O valor_total enviado (20) e ignorado: sem itens, o total comeca no frete.
    expect(pedidosModel.create).toHaveBeenCalledWith({ ...payload, valor_total: 5 });
    expect(response.send).toHaveBeenCalledWith(pedido);
  });

  it("create retorna 400 quando o pedido manual tenta nascer pago", async () => {
    const response = mockResponse();
    await PedidosController.create(mockRequest({ body: { ...payload, status: "pago" } }), response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      message: "Um pedido novo so pode comecar em aguardando_calculo_frete ou aguardando_pagamento.",
    });
    expect(pedidosModel.create).not.toHaveBeenCalled();
  });

  it("update retorna 400 para id invalido", async () => {
    const response = mockResponse();
    await PedidosController.update(mockRequest({ params: { id: "x" }, body: {} }), response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "ID do pedido invalido." });
  });

  it("update retorna 404 quando o pedido nao existe", async () => {
    const response = mockResponse();
    pedidosModel.findByPk.mockResolvedValueOnce(null);
    await PedidosController.update(mockRequest({ params: { id: "1" }, body: {} }), response);
    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ message: "Pedido nao encontrado." });
  });

  it("update retorna 400 para status invalido", async () => {
    const response = mockResponse(), pedido = buildModelInstance({ id_pedido: 1, id_usuario: 1, id_usuario_endereco: 1, status: "pago", valor_total: 10, valor_frete: 2 });
    pedidosModel.findByPk.mockResolvedValueOnce(pedido);
    await PedidosController.update(mockRequest({ params: { id: "1" }, body: { status: "foo" } }), response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "status invalido." });
  });

  it("update retorna 404 quando o usuario informado nao existe", async () => {
    const response = mockResponse(), pedido = buildModelInstance({ id_pedido: 1, id_usuario: 1, id_usuario_endereco: 1, status: "pago", valor_total: 10, valor_frete: 2 });
    pedidosModel.findByPk.mockResolvedValueOnce(pedido);
    usuariosModel.findByPk.mockResolvedValueOnce(null);
    await PedidosController.update(mockRequest({ params: { id: "1" }, body: { id_usuario: 2 } }), response);
    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ message: "Usuario nao encontrado." });
  });

  it("update retorna 404 quando o endereco informado nao existe", async () => {
    const response = mockResponse(), pedido = buildModelInstance({ id_pedido: 1, id_usuario: 1, id_usuario_endereco: 1, status: "pago", valor_total: 10, valor_frete: 2 });
    pedidosModel.findByPk.mockResolvedValueOnce(pedido);
    enderecosModel.findByPk.mockResolvedValueOnce(null);
    await PedidosController.update(mockRequest({ params: { id: "1" }, body: { id_usuario_endereco: 3 } }), response);
    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ message: "Endereco do usuario nao encontrado." });
  });

  it("update retorna 400 quando o endereco nao pertence ao usuario", async () => {
    const response = mockResponse(), pedido = buildModelInstance({ id_pedido: 1, id_usuario: 1, id_usuario_endereco: 1, status: "pago", valor_total: 10, valor_frete: 2 });
    pedidosModel.findByPk.mockResolvedValueOnce(pedido);
    usuariosModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_usuario: 2 }));
    enderecosModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_usuario_endereco: 1, id_usuario: 1 }));
    await PedidosController.update(mockRequest({ params: { id: "1" }, body: { id_usuario: 2 } }), response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "O endereco informado nao pertence ao usuario informado." });
  });

  it("update retorna 400 para id_usuario_endereco invalido", async () => {
    const response = mockResponse(), pedido = buildModelInstance({ id_pedido: 1, id_usuario: 1, id_usuario_endereco: 1, status: "pago", valor_total: 10, valor_frete: 2 });
    pedidosModel.findByPk.mockResolvedValueOnce(pedido);
    await PedidosController.update(mockRequest({ params: { id: "1" }, body: { id_usuario_endereco: "x" } }), response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "id_usuario_endereco invalido." });
  });

  it("update retorna 200 com o pedido atualizado", async () => {
    const response = mockResponse(), pedido = buildModelInstance({ id_pedido: 1, id_usuario: 1, id_usuario_endereco: 1, status: "pago", valor_total: 10, valor_frete: 2 });
    pedidosModel.findByPk.mockResolvedValueOnce(pedido);
    usuariosModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_usuario: 1 }));
    enderecosModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_usuario_endereco: 1, id_usuario: 1 }));
    await PedidosController.update(
      mockRequest({ params: { id: "1" }, body: { id_usuario: 1, id_usuario_endereco: 1, status: "enviado" } }),
      response,
    );
    expect(pedido.update).toHaveBeenCalledWith({
      id_usuario: 1,
      id_usuario_endereco: 1,
      status: "enviado",
      valor_frete: 2,
    });
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.send).toHaveBeenCalledWith(pedido);
  });

  it.each([
    ["entregue", "aguardando_pagamento"],
    ["enviado", "cancelado"],
    ["cancelado", "pago"],
    ["aguardando_pagamento", "entregue"],
  ])("update retorna 409 na transicao invalida %s -> %s", async (atual, novo) => {
    const response = mockResponse(), pedido = buildModelInstance({ id_pedido: 1, id_usuario: 1, id_usuario_endereco: 1, status: atual, valor_total: 10, valor_frete: 2 });
    pedidosModel.findByPk.mockResolvedValueOnce(pedido);
    await PedidosController.update(mockRequest({ params: { id: "1" }, body: { status: novo } }), response);
    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith({ message: `Transicao de status invalida: ${atual} -> ${novo}.` });
    expect(pedido.update).not.toHaveBeenCalled();
  });

  it("update ignora valor_total do corpo e recalcula com o novo frete", async () => {
    const response = mockResponse(), pedido = buildModelInstance({ id_pedido: 1, id_usuario: 1, id_usuario_endereco: 1, status: "aguardando_calculo_frete", valor_total: 30, valor_frete: 0 });
    pedidosModel.findByPk.mockResolvedValueOnce(pedido);
    enderecosModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_usuario_endereco: 1, id_usuario: 1 }));
    pedidoItensModel.findAll.mockResolvedValueOnce([{ subtotal: 20 }, { subtotal: "10.50" }]);
    await PedidosController.update(
      mockRequest({ params: { id: "1" }, body: { status: "aguardando_pagamento", valor_frete: 12.3, valor_total: 1 } }),
      response,
    );
    expect(pedido.update).toHaveBeenLastCalledWith({ valor_total: 42.8 });
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it("remove retorna 400 para id invalido", async () => {
    const response = mockResponse();
    await PedidosController.remove(mockRequest({ params: { id: "x" } }), response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "ID do pedido invalido." });
  });

  it("remove retorna 404 quando o pedido nao existe", async () => {
    const response = mockResponse();
    pedidosModel.findByPk.mockResolvedValueOnce(null);
    await PedidosController.remove(mockRequest({ params: { id: "1" } }), response);
    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ message: "Pedido nao encontrado." });
  });

  it("remove retorna 204 quando exclui o pedido", async () => {
    const response = mockResponse(), pedido = buildModelInstance({ id_pedido: 1 });
    pedidosModel.findByPk.mockResolvedValueOnce(pedido);
    await PedidosController.remove(mockRequest({ params: { id: "1" } }), response);
    expect(pedido.destroy).toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(204);
  });
});

describe("PedidoItensController", () => {
  const payload = { id_pedido: 1, id_produto_cor: 1, id_produto_grade: 1, quantidade: 1, preco_unitario: 10 };
  const pedidoAberto = (status = "aguardando_pagamento") => buildModelInstance({ id_pedido: 1, status, valor_frete: 0 });

  it("create retorna 409 quando o pedido ja foi pago", async () => {
    const response = mockResponse();
    pedidosModel.findByPk.mockResolvedValueOnce(pedidoAberto("pago"));
    await PedidoItensController.create(mockRequest({ body: payload }), response);
    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith({ message: "Itens so podem ser alterados enquanto o pedido nao foi pago." });
    expect(pedidoItensModel.create).not.toHaveBeenCalled();
  });

  it("getByIdOrder retorna 400 para id invalido", async () => {
    const response = mockResponse();
    await PedidoItensController.getByIdOrder(mockRequest({ params: { id_order: "x" } }), response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "ID do pedido invalido." });
  });

  it("getByIdOrder retorna 200 com lista vazia", async () => {
    const response = mockResponse();
    pedidoItensModel.findAll.mockResolvedValueOnce([]);
    await PedidoItensController.getByIdOrder(mockRequest({ params: { id_order: "1" } }), response);
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.send).toHaveBeenCalledWith([]);
  });

  it("create retorna 400 sem campos obrigatorios", async () => {
    const response = mockResponse();
    await PedidoItensController.create(mockRequest({ body: {} }), response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "id_pedido, id_produto_cor, id_produto_grade e quantidade sao obrigatorios." });
  });

  it("create retorna 400 para id_pedido invalido", async () => {
    const response = mockResponse();
    await PedidoItensController.create(mockRequest({ body: { id_pedido: "x", id_produto_cor: 1, id_produto_grade: 1, quantidade: 1 } }), response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "id_pedido invalido." });
  });

  it("create retorna 404 quando o pedido nao existe", async () => {
    const response = mockResponse();
    pedidosModel.findByPk.mockResolvedValueOnce(null);
    await PedidoItensController.create(mockRequest({ body: payload }), response);
    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ message: "Pedido nao encontrado." });
  });

  it("create retorna 404 quando a cor nao existe", async () => {
    const response = mockResponse();
    pedidosModel.findByPk.mockResolvedValueOnce(pedidoAberto());
    coresModel.findByPk.mockResolvedValueOnce(null);
    await PedidoItensController.create(mockRequest({ body: payload }), response);
    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ message: "Cor do produto nao encontrada." });
  });

  it("create retorna 404 quando a grade nao existe", async () => {
    const response = mockResponse();
    pedidosModel.findByPk.mockResolvedValueOnce(pedidoAberto());
    coresModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_produto_cor: 1, id_produto: 7 }));
    gradesModel.findByPk.mockResolvedValueOnce(null);
    await PedidoItensController.create(mockRequest({ body: payload }), response);
    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ message: "Grade do produto nao encontrada." });
  });

  it("create retorna 400 quando cor e grade nao pertencem ao mesmo produto", async () => {
    const response = mockResponse();
    pedidosModel.findByPk.mockResolvedValueOnce(pedidoAberto());
    coresModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_produto_cor: 1, id_produto: 7 }));
    gradesModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_produto_grade: 1, id_produto: 8 }));
    await PedidoItensController.create(mockRequest({ body: payload }), response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "A cor e a grade informadas nao pertencem ao mesmo produto." });
  });

  it("create retorna 201 com o item criado", async () => {
    const response = mockResponse(), item = buildModelInstance({ id_pedido_item: 1, id_pedido: 1, id_produto_cor: 1, id_produto_grade: 1, quantidade: 1, preco_unitario: 10 });
    pedidosModel.findByPk.mockResolvedValueOnce(pedidoAberto());
    coresModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_produto_cor: 1, id_produto: 7 }));
    gradesModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_produto_grade: 1, id_produto: 7 }));
    resolveProdutoContextMock.mockResolvedValueOnce({ precoUnitario: 10 });
    enrichItemsWithProductDataMock.mockResolvedValueOnce([item]);
    pedidoItensModel.create.mockResolvedValueOnce(item);
    pedidoItensModel.findAll.mockResolvedValueOnce([item]);
    await PedidoItensController.create(mockRequest({ body: payload }), response);
    expect(response.status).toHaveBeenCalledWith(201);
    expect(pedidoItensModel.create).toHaveBeenCalledWith({
      id_pedido: 1,
      id_produto_cor: 1,
      id_produto_grade: 1,
      quantidade: 1,
      preco_unitario: 10,
      subtotal: 10,
    });
    expect(pedidoItensModel.findAll).toHaveBeenCalledWith({ where: { id_pedido: 1 } });
    expect(response.send).toHaveBeenCalledWith(item);
  });

  it("update retorna 400 para id invalido", async () => {
    const response = mockResponse();
    await PedidoItensController.update(mockRequest({ params: { id: "x" }, body: {} }), response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "ID do item invalido." });
  });

  it("update retorna 404 quando o item nao existe", async () => {
    const response = mockResponse();
    pedidoItensModel.findByPk.mockResolvedValueOnce(null);
    await PedidoItensController.update(mockRequest({ params: { id: "1" }, body: {} }), response);
    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ message: "Item do pedido nao encontrado." });
  });

  it("update retorna 404 quando o pedido informado nao existe", async () => {
    const response = mockResponse(), item = buildModelInstance({ id_pedido_item: 1, id_pedido: 1, id_produto_cor: 1, id_produto_grade: 1, quantidade: 1, preco_unitario: 10 });
    pedidoItensModel.findByPk.mockResolvedValueOnce(item);
    pedidosModel.findByPk.mockResolvedValueOnce(null);
    await PedidoItensController.update(mockRequest({ params: { id: "1" }, body: { id_pedido: 2 } }), response);
    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ message: "Pedido nao encontrado." });
  });

  it("update retorna 404 quando a cor informada nao existe", async () => {
    const response = mockResponse(), item = buildModelInstance({ id_pedido_item: 1, id_pedido: 1, id_produto_cor: 1, id_produto_grade: 1, quantidade: 1, preco_unitario: 10 });
    pedidoItensModel.findByPk.mockResolvedValueOnce(item);
    coresModel.findByPk.mockResolvedValueOnce(null);
    await PedidoItensController.update(mockRequest({ params: { id: "1" }, body: { id_produto_cor: 2 } }), response);
    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ message: "Cor do produto nao encontrada." });
  });

  it("update retorna 404 quando a grade informada nao existe", async () => {
    const response = mockResponse(), item = buildModelInstance({ id_pedido_item: 1, id_pedido: 1, id_produto_cor: 1, id_produto_grade: 1, quantidade: 1, preco_unitario: 10 });
    pedidoItensModel.findByPk.mockResolvedValueOnce(item);
    coresModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_produto_cor: 1, id_produto: 7 }));
    gradesModel.findByPk.mockResolvedValueOnce(null);
    await PedidoItensController.update(mockRequest({ params: { id: "1" }, body: { id_produto_grade: 3 } }), response);
    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ message: "Grade do produto nao encontrada." });
  });

  it("update retorna 400 quando cor e grade nao pertencem ao mesmo produto", async () => {
    const response = mockResponse(), item = buildModelInstance({ id_pedido_item: 1, id_pedido: 1, id_produto_cor: 1, id_produto_grade: 1, quantidade: 1, preco_unitario: 10 });
    pedidoItensModel.findByPk.mockResolvedValueOnce(item);
    coresModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_produto_cor: 2, id_produto: 7 }));
    gradesModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_produto_grade: 3, id_produto: 8 }));
    await PedidoItensController.update(mockRequest({ params: { id: "1" }, body: { id_produto_cor: 2, id_produto_grade: 3 } }), response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "A cor e a grade informadas nao pertencem ao mesmo produto." });
  });

  it("update retorna 400 para id_produto_cor invalido", async () => {
    const response = mockResponse(), item = buildModelInstance({ id_pedido_item: 1, id_pedido: 1, id_produto_cor: 1, id_produto_grade: 1, quantidade: 1, preco_unitario: 10 });
    pedidoItensModel.findByPk.mockResolvedValueOnce(item);
    await PedidoItensController.update(mockRequest({ params: { id: "1" }, body: { id_produto_cor: "x" } }), response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "id_produto_cor invalido." });
  });

  it("update retorna 200 com o item atualizado", async () => {
    const response = mockResponse(), item = buildModelInstance({ id_pedido_item: 1, id_pedido: 1, id_produto_cor: 1, id_produto_grade: 1, quantidade: 1, preco_unitario: 10 });
    pedidoItensModel.findByPk.mockResolvedValueOnce(item);
    pedidosModel.findByPk.mockResolvedValueOnce(pedidoAberto());
    coresModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_produto_cor: 2, id_produto: 7 }));
    gradesModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_produto_grade: 3, id_produto: 7 }));
    resolveProdutoContextMock.mockResolvedValueOnce({ precoUnitario: 10 });
    enrichItemsWithProductDataMock.mockResolvedValueOnce([item]);
    pedidoItensModel.findAll.mockResolvedValueOnce([item]);
    await PedidoItensController.update(
      mockRequest({ params: { id: "1" }, body: { id_pedido: 1, id_produto_cor: 2, id_produto_grade: 3, quantidade: 2 } }),
      response,
    );
    expect(item.update).toHaveBeenCalledWith({
      id_pedido: 1,
      id_produto_cor: 2,
      id_produto_grade: 3,
      quantidade: 2,
      preco_unitario: 10,
      subtotal: 20,
    });
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.send).toHaveBeenCalledWith(item);
    expect(normalizeItemQuantityMock).toHaveBeenCalled();
    expect(calculateSubtotalMock).toHaveBeenCalled();
  });

  it("remove retorna 400 para id invalido", async () => {
    const response = mockResponse();
    await PedidoItensController.remove(mockRequest({ params: { id: "x" } }), response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "ID do item invalido." });
  });

  it("remove retorna 404 quando o item nao existe", async () => {
    const response = mockResponse();
    pedidoItensModel.findByPk.mockResolvedValueOnce(null);
    await PedidoItensController.remove(mockRequest({ params: { id: "1" } }), response);
    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ message: "Item do pedido nao encontrado." });
  });

  it("remove retorna 204 quando exclui o item e recalcula o total", async () => {
    const response = mockResponse(), item = buildModelInstance({ id_pedido_item: 1, id_pedido: 1 }), pedido = pedidoAberto();
    pedidoItensModel.findByPk.mockResolvedValueOnce(item);
    pedidosModel.findByPk.mockResolvedValueOnce(pedido);
    pedidoItensModel.findAll.mockResolvedValueOnce([]);
    await PedidoItensController.remove(mockRequest({ params: { id: "1" } }), response);
    expect(item.destroy).toHaveBeenCalled();
    expect(pedido.update).toHaveBeenCalledWith({ valor_total: 0 });
    expect(response.status).toHaveBeenCalledWith(204);
  });

  it("remove e update retornam 409 quando o pedido ja foi enviado", async () => {
    const item = buildModelInstance({ id_pedido_item: 1, id_pedido: 1, id_produto_cor: 1, id_produto_grade: 1, quantidade: 1 });
    const removeResponse = mockResponse(), updateResponse = mockResponse();
    pedidoItensModel.findByPk.mockResolvedValueOnce(item).mockResolvedValueOnce(item);
    pedidosModel.findByPk.mockResolvedValueOnce(pedidoAberto("enviado")).mockResolvedValueOnce(pedidoAberto("enviado"));
    await PedidoItensController.remove(mockRequest({ params: { id: "1" } }), removeResponse);
    await PedidoItensController.update(mockRequest({ params: { id: "1" }, body: { quantidade: 3 } }), updateResponse);
    expect(removeResponse.status).toHaveBeenCalledWith(409);
    expect(updateResponse.status).toHaveBeenCalledWith(409);
    expect(item.destroy).not.toHaveBeenCalled();
    expect(item.update).not.toHaveBeenCalled();
  });
});

describe("PedidosController.checkout", () => {
  const finalizar = CheckoutService.finalizar as unknown as jest.Mock;
  const authLocals = { authUser: { id_usuario: 1 } };

  beforeEach(() => finalizar.mockReset());

  it("usa o usuario do token, nao o do corpo", async () => {
    finalizar.mockResolvedValue({ id_pedido: 7 });
    const res = mockResponse();
    res.locals = authLocals;

    await PedidosController.checkout(
      mockRequest({ body: { id_usuario_endereco: 3, id_usuario: 99 } }) as never,
      res as never,
    );

    expect(finalizar).toHaveBeenCalledWith(1, 3);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("exige um endereco", async () => {
    const res = mockResponse();
    res.locals = authLocals;

    await PedidosController.checkout(mockRequest({ body: {} }) as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(finalizar).not.toHaveBeenCalled();
  });

  it("devolve a mensagem de erros conhecidos do checkout", async () => {
    finalizar.mockRejectedValue(new CheckoutError(409, "indisponivel"));
    const res = mockResponse();
    res.locals = authLocals;

    await PedidosController.checkout(mockRequest({ body: { id_usuario_endereco: 3 } }) as never, res as never);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: "indisponivel" });
  });
});
