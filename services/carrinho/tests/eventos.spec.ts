import CarrinhoItens from "../src/models/CarrinhoItens";
import Carrinhos from "../src/models/Carrinhos";
import { tratarEvento } from "../src/eventos";
import type { AgnusEvent } from "@agnus/comum/types/event.types";

jest.mock("../src/models/CarrinhoItens", () => ({ __esModule: true, default: { destroy: jest.fn() } }));
jest.mock("../src/models/Carrinhos", () => ({ __esModule: true, default: { findAll: jest.fn(), destroy: jest.fn() } }));
jest.mock("@agnus/comum/services/eventBus.service", () => ({ __esModule: true, default: {} }));

const evento = (type: string, payload: object) => ({ type, payload }) as unknown as AgnusEvent;

describe("eventos do carrinho", () => {
  it("tira da sacola as peças de um produto removido", async () => {
    await tratarEvento(evento("produto.removido", { id_produto: 1, cores: [2], grades: [3] }));
    expect(CarrinhoItens.destroy).toHaveBeenCalledTimes(1);
  });

  it("apaga as sacolas de um usuário removido", async () => {
    (Carrinhos.findAll as jest.Mock).mockResolvedValueOnce([{ id_carrinho: 9 }]);
    await tratarEvento(evento("usuario.removido", { id_usuario: 5 }));
    expect(CarrinhoItens.destroy).toHaveBeenCalledWith({ where: { id_carrinho: [9] } });
    expect(Carrinhos.destroy).toHaveBeenCalledWith({ where: { id_carrinho: [9] } });
  });

  it("ignora os demais eventos", async () => {
    await tratarEvento(evento("pedido.criado", {}));
    expect(CarrinhoItens.destroy).not.toHaveBeenCalled();
  });
});
