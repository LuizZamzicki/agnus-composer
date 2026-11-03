import sequelize from "../../src/config/database";
import CarrinhoItens from "../../src/models/CarrinhoItens";
import Carrinhos from "../../src/models/Carrinhos";
import PedidoItens from "../../src/models/PedidoItens";
import Pedidos from "../../src/models/Pedidos";
import UsuarioEnderecos from "../../src/models/UsuarioEnderecos";
import CheckoutService, { CheckoutError } from "../../src/services/checkout.service";
import EventBusService from "../../src/services/eventBus.service";
import { resolveProdutoContext } from "../../src/utils/itemDetails";

const transaction = { LOCK: { UPDATE: "UPDATE" } };

jest.mock("../../src/config/database", () => ({
  __esModule: true,
  default: { transaction: jest.fn() },
}));
jest.mock("../../src/models/CarrinhoItens", () => ({
  __esModule: true,
  default: { findAll: jest.fn(), destroy: jest.fn() },
}));
jest.mock("../../src/models/Carrinhos", () => ({ __esModule: true, default: { findAll: jest.fn() } }));
jest.mock("../../src/models/PedidoItens", () => ({ __esModule: true, default: { bulkCreate: jest.fn() } }));
jest.mock("../../src/models/Pedidos", () => ({ __esModule: true, default: { create: jest.fn() } }));
jest.mock("../../src/models/UsuarioEnderecos", () => ({ __esModule: true, default: { findByPk: jest.fn() } }));
jest.mock("../../src/services/eventBus.service", () => ({ __esModule: true, default: { publish: jest.fn() } }));
jest.mock("../../src/utils/itemDetails", () => ({
  __esModule: true,
  calculateSubtotal: (preco: number, quantidade: number) => preco * quantidade,
  normalizeItemQuantity: (quantidade: number) => quantidade,
  resolveProdutoContext: jest.fn(),
}));

const mocks = {
  transaction: sequelize.transaction as unknown as jest.Mock,
  itens: CarrinhoItens.findAll as unknown as jest.Mock,
  destroy: CarrinhoItens.destroy as unknown as jest.Mock,
  carrinhos: Carrinhos.findAll as unknown as jest.Mock,
  bulkCreate: PedidoItens.bulkCreate as unknown as jest.Mock,
  create: Pedidos.create as unknown as jest.Mock,
  endereco: UsuarioEnderecos.findByPk as unknown as jest.Mock,
  publish: EventBusService.publish as unknown as jest.Mock,
  contexto: resolveProdutoContext as unknown as jest.Mock,
};

const item = (id: number, quantidade: number) => ({
  id_carrinho_item: id,
  id_produto_cor: id * 10,
  id_produto_grade: id * 100,
  quantidade,
});

describe("CheckoutService", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mocks.transaction.mockImplementation((work) => work(transaction));
    mocks.endereco.mockResolvedValue({ id_usuario: 1 });
    mocks.carrinhos.mockResolvedValue([{ id_carrinho: 5 }]);
    mocks.itens.mockResolvedValue([item(1, 2), item(2, 1)]);
    mocks.contexto.mockResolvedValue({ produto: { ativo: true }, precoUnitario: 49.9 });
    mocks.create.mockResolvedValue({ id_pedido: 7, id_usuario: 1, status: "aguardando_pagamento", valor_total: 149.7 });
  });

  it("calcula o total no servidor e grava pedido, itens e baixa da sacola juntos", async () => {
    const pedido = await CheckoutService.finalizar(1, 3);

    expect(pedido.id_pedido).toBe(7);
    expect(mocks.create).toHaveBeenCalledWith(
      {
        id_usuario: 1,
        id_usuario_endereco: 3,
        status: "aguardando_pagamento",
        valor_total: 149.7,
        valor_frete: 0,
      },
      { transaction },
    );
    expect(mocks.bulkCreate).toHaveBeenCalledWith(
      [
        { id_pedido: 7, id_produto_cor: 10, id_produto_grade: 100, quantidade: 2, preco_unitario: 49.9, subtotal: 99.8 },
        { id_pedido: 7, id_produto_cor: 20, id_produto_grade: 200, quantidade: 1, preco_unitario: 49.9, subtotal: 49.9 },
      ],
      { transaction },
    );
    expect(mocks.destroy).toHaveBeenCalledWith({ where: { id_carrinho_item: [1, 2] }, transaction });
    expect(mocks.publish).toHaveBeenCalledWith("pedido.criado", expect.objectContaining({ id_pedido: 7 }));
  });

  it("recusa endereço de outro usuário", async () => {
    mocks.endereco.mockResolvedValue({ id_usuario: 2 });

    await expect(CheckoutService.finalizar(1, 3)).rejects.toMatchObject({ status: 404 });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("recusa sacola vazia sem criar pedido", async () => {
    mocks.itens.mockResolvedValue([]);

    await expect(CheckoutService.finalizar(1, 3)).rejects.toMatchObject({ status: 400 });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it.each([
    ["peça que deixou de existir", null],
    ["produto inativo", { produto: { ativo: false }, precoUnitario: 10 }],
  ])("não cria pedido com %s", async (_caso, contexto) => {
    mocks.contexto.mockResolvedValue(contexto);

    const erro = await CheckoutService.finalizar(1, 3).catch((error) => error);

    expect(erro).toBeInstanceOf(CheckoutError);
    expect(erro.status).toBe(409);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.destroy).not.toHaveBeenCalled();
  });

  it("não publica evento quando a transação falha", async () => {
    mocks.bulkCreate.mockRejectedValue(new Error("falha no banco"));

    await expect(CheckoutService.finalizar(1, 3)).rejects.toThrow("falha no banco");
    expect(mocks.publish).not.toHaveBeenCalled();
  });
});
