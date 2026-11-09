import sequelize from "@agnus/comum/config/database";
import EventBusService from "@agnus/comum/services/eventBus.service";
import { HttpError } from "@agnus/comum/types/http_error";
import { chamarServico, consultarOuNull } from "@agnus/comum/utils/clienteInterno";
import { consultarSelecoes } from "@agnus/comum/utils/itemDetails";
import PedidoItens from "../../src/models/PedidoItens";
import Pedidos from "../../src/models/Pedidos";
import CheckoutService, { CheckoutError } from "../../src/services/checkout.service";

const transaction = { id: "tx" };

jest.mock("@agnus/comum/config/database", () => ({ __esModule: true, default: { transaction: jest.fn() } }));
jest.mock("../../src/models/PedidoItens", () => ({ __esModule: true, default: { bulkCreate: jest.fn(), destroy: jest.fn() } }));
jest.mock("../../src/models/Pedidos", () => ({ __esModule: true, default: { create: jest.fn() } }));
jest.mock("@agnus/comum/services/eventBus.service", () => ({ __esModule: true, default: { publish: jest.fn() } }));
jest.mock("@agnus/comum/utils/clienteInterno", () => ({ __esModule: true, chamarServico: jest.fn(), consultarOuNull: jest.fn() }));
jest.mock("@agnus/comum/utils/itemDetails", () => ({
  __esModule: true,
  calculateSubtotal: (preco: number, quantidade: number) => preco * quantidade,
  normalizeItemQuantity: (quantidade: number) => quantidade,
  consultarSelecoes: jest.fn(),
}));

const mocks = {
  transaction: sequelize.transaction as unknown as jest.Mock,
  bulkCreate: PedidoItens.bulkCreate as unknown as jest.Mock,
  destroyItens: PedidoItens.destroy as unknown as jest.Mock,
  create: Pedidos.create as unknown as jest.Mock,
  endereco: consultarOuNull as unknown as jest.Mock,
  chamar: chamarServico as unknown as jest.Mock,
  publish: EventBusService.publish as unknown as jest.Mock,
  selecoes: consultarSelecoes as unknown as jest.Mock,
};

const item = (id: number, quantidade: number) => ({
  id_carrinho_item: id,
  id_produto_cor: id * 10,
  id_produto_grade: id * 100,
  quantidade,
});
const disponivel = { contexto: { produto: { ativo: true }, precoUnitario: 49.9 } };
const destroyPedido = jest.fn();

const configurarCarrinho = (itens: object[], removidos: number | Error) => {
  mocks.chamar.mockImplementation(async (_servico: string, caminho: string) => {
    if (caminho === "/itens/baixar") {
      if (removidos instanceof Error) {
        throw removidos;
      }

      return { status: 200, data: { removidos } };
    }

    return { status: 200, data: itens };
  });
};

describe("CheckoutService (saga)", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mocks.transaction.mockImplementation((work) => work(transaction));
    mocks.endereco.mockResolvedValue({ id_usuario: 1 });
    mocks.selecoes.mockResolvedValue([disponivel, disponivel]);
    mocks.create.mockResolvedValue({
      id_pedido: 7,
      id_usuario: 1,
      status: "aguardando_pagamento",
      valor_total: 149.7,
      destroy: destroyPedido,
    });
    configurarCarrinho([item(1, 2), item(2, 1)], 2);
  });

  it("calcula o total no servidor, grava o pedido e baixa a sacola", async () => {
    const pedido = await CheckoutService.finalizar(1, 3);

    expect(pedido.id_pedido).toBe(7);
    expect(mocks.create).toHaveBeenCalledWith(
      { id_usuario: 1, id_usuario_endereco: 3, status: "aguardando_pagamento", valor_total: 149.7, valor_frete: 0 },
      { transaction },
    );
    expect(mocks.bulkCreate).toHaveBeenCalledWith(
      [
        { id_pedido: 7, id_produto_cor: 10, id_produto_grade: 100, quantidade: 2, preco_unitario: 49.9, subtotal: 99.8 },
        { id_pedido: 7, id_produto_cor: 20, id_produto_grade: 200, quantidade: 1, preco_unitario: 49.9, subtotal: 49.9 },
      ],
      { transaction },
    );
    expect(mocks.chamar).toHaveBeenCalledWith("carrinho", "/itens/baixar", { method: "POST", body: { ids: [1, 2] } });
    expect(mocks.publish).toHaveBeenCalledWith("pedido.criado", expect.objectContaining({ id_pedido: 7 }));
  });

  it.each([["de outro usuário", { id_usuario: 2 }], ["inexistente", null]])("recusa endereço %s", async (_caso, endereco) => {
    mocks.endereco.mockResolvedValue(endereco);

    await expect(CheckoutService.finalizar(1, 3)).rejects.toMatchObject({ status: 404 });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("recusa sacola vazia sem criar pedido", async () => {
    configurarCarrinho([], 0);

    await expect(CheckoutService.finalizar(1, 3)).rejects.toMatchObject({ status: 400 });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it.each([
    ["peça que deixou de existir", { contexto: null }],
    ["produto inativo", { contexto: { produto: { ativo: false }, precoUnitario: 10 } }],
  ])("não cria pedido com %s", async (_caso, selecao) => {
    mocks.selecoes.mockResolvedValue([selecao, disponivel]);

    const erro = await CheckoutService.finalizar(1, 3).catch((error) => error);

    expect(erro).toBeInstanceOf(CheckoutError);
    expect(erro.status).toBe(409);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("não publica evento quando a transação falha", async () => {
    mocks.bulkCreate.mockRejectedValue(new Error("falha no banco"));

    await expect(CheckoutService.finalizar(1, 3)).rejects.toThrow("falha no banco");
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("desfaz o pedido quando outra compra já baixou a sacola", async () => {
    configurarCarrinho([item(1, 2), item(2, 1)], 0);

    await expect(CheckoutService.finalizar(1, 3)).rejects.toMatchObject({ status: 409 });
    expect(mocks.destroyItens).toHaveBeenCalledWith({ where: { id_pedido: 7 }, transaction });
    expect(destroyPedido).toHaveBeenCalledWith({ transaction });
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("desfaz o pedido quando o serviço de carrinho cai na baixa", async () => {
    configurarCarrinho([item(1, 2), item(2, 1)], new HttpError(503, "indisponível"));

    await expect(CheckoutService.finalizar(1, 3)).rejects.toMatchObject({ status: 503 });
    expect(destroyPedido).toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
  });
});
