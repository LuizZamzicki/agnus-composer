import Carrinhos from "../../src/models/Carrinhos";
import CarrinhoItens from "../../src/models/CarrinhoItens";
import { OWNERS } from "../../src/middlewares/donos";

jest.mock("../../src/models/Carrinhos", () => ({ __esModule: true, default: { findByPk: jest.fn() } }));
jest.mock("../../src/models/CarrinhoItens", () => ({ __esModule: true, default: { findByPk: jest.fn() } }));

describe("OWNERS", () => {
  it("resolve o dono do item pelo carrinho", async () => {
    (CarrinhoItens.findByPk as jest.Mock).mockResolvedValueOnce({ id_carrinho: 8 });
    (Carrinhos.findByPk as jest.Mock).mockResolvedValueOnce({ id_usuario: 2 });
    await expect(OWNERS.carrinhoItem(1)).resolves.toBe(2);
  });

  it("retorna null para recurso inexistente", async () => {
    (CarrinhoItens.findByPk as jest.Mock).mockResolvedValueOnce(null);
    (Carrinhos.findByPk as jest.Mock).mockResolvedValueOnce(null);
    await expect(OWNERS.carrinhoItem(1)).resolves.toBeNull();
    await expect(OWNERS.carrinho(1)).resolves.toBeNull();
  });
});
