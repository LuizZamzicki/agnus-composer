import AvaliacaoFotos from "../../src/models/AvaliacaoFotos";
import AvaliacaoProdutos from "../../src/models/AvaliacaoProdutos";
import { OWNERS } from "../../src/middlewares/donos";

jest.mock("../../src/models/AvaliacaoFotos", () => ({ __esModule: true, default: { findByPk: jest.fn() } }));
jest.mock("../../src/models/AvaliacaoProdutos", () => ({ __esModule: true, default: { findByPk: jest.fn() } }));

describe("OWNERS", () => {
  it("resolve o dono da foto pela avaliação", async () => {
    (AvaliacaoFotos.findByPk as jest.Mock).mockResolvedValueOnce({ id_avaliacao_produto: 7 });
    (AvaliacaoProdutos.findByPk as jest.Mock).mockResolvedValueOnce({ id_usuario: 6 });
    await expect(OWNERS.avaliacaoFoto(1)).resolves.toBe(6);
  });

  it("retorna null para recurso inexistente", async () => {
    (AvaliacaoFotos.findByPk as jest.Mock).mockResolvedValueOnce(null);
    (AvaliacaoProdutos.findByPk as jest.Mock).mockResolvedValueOnce(null);
    await expect(OWNERS.avaliacaoFoto(1)).resolves.toBeNull();
    await expect(OWNERS.avaliacao(1)).resolves.toBeNull();
  });
});
