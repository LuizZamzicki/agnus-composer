import { buscarProdutoYouDraw, listarProdutosYouDraw } from "@agnus/comum/utils/youdraw";
import ProdutoCores from "../../src/models/ProdutoCores";
import ProdutoGrades from "../../src/models/ProdutoGrades";
import Produtos from "../../src/models/Produtos";
import sequelize from "@agnus/comum/config/database";
import SkuService, { normalizar, ProdutoSkus } from "../../src/services/sku.service";

jest.mock("@agnus/comum/utils/logger", () => ({ __esModule: true, default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock("@agnus/comum/utils/youdraw", () => ({
  ...jest.requireActual("@agnus/comum/utils/youdraw"),
  listarProdutosYouDraw: jest.fn(),
  buscarProdutoYouDraw: jest.fn(),
}));
jest.mock("../../src/models/Produtos", () => ({ __esModule: true, default: { findByPk: jest.fn() } }));
jest.mock("../../src/models/ProdutoCores", () => ({ __esModule: true, default: { findAll: jest.fn() } }));
jest.mock("../../src/models/ProdutoGrades", () => ({ __esModule: true, default: { findAll: jest.fn() } }));

jest.spyOn(sequelize, "transaction").mockImplementation(((fn: (t: object) => unknown) => fn({})) as never);

const skusDoBanco: { id_produto: number; cor: string; tamanho: string; sku: string; id_produto_fornecedor: string | null }[] = [];
jest.spyOn(ProdutoSkus, "findAll").mockImplementation((async () => skusDoBanco) as never);
jest.spyOn(ProdutoSkus, "findOne").mockImplementation((async () => null) as never);
const criar = jest.spyOn(ProdutoSkus, "create").mockImplementation((async (d: never) => { skusDoBanco.push(d); return d; }) as never);
jest.spyOn(ProdutoSkus, "destroy").mockImplementation((async () => 0) as never);

const AMBIENTE = { ...process.env };

beforeEach(() => {
  jest.clearAllMocks();
  skusDoBanco.length = 0;
  process.env = { ...AMBIENTE, YOUDRAW_API_KEY: "yd_live_chaveDeTeste123" };
  (Produtos.findByPk as jest.Mock).mockResolvedValue({ id_produto: 1, nome: "Camiseta DryFit Basic Masculina" });
  (ProdutoCores.findAll as jest.Mock).mockResolvedValue([{ id_produto_cor: 10, id_produto: 1, nome: "Preto" }]);
  (ProdutoGrades.findAll as jest.Mock).mockResolvedValue([
    { id_produto_grade: 20, id_produto: 1, nome: "M" },
    { id_produto_grade: 21, id_produto: 1, nome: "G" },
  ]);
});

afterAll(() => {
  process.env = AMBIENTE;
});

it("normaliza nomes (acento, caixa, espaços)", () => {
  expect(normalizar("  Azul  Bebê ")).toBe("azul bebe");
});

describe("salvar", () => {
  it("grava os SKUs das combinações que existem", async () => {
    await SkuService.salvar(1, { skus: [{ cor: "Preto", tamanho: "M", sku: "DRY-P-M" }] });
    expect(criar).toHaveBeenCalledWith(expect.objectContaining({ id_produto: 1, cor: "Preto", tamanho: "M", sku: "DRY-P-M" }), expect.anything());
  });

  it("recusa combinação inexistente, SKU com espaço e o mesmo SKU em duas combinações", async () => {
    await expect(SkuService.salvar(1, { skus: [{ cor: "Branco", tamanho: "M", sku: "X" }] })).rejects.toMatchObject({ status: 400 });
    await expect(SkuService.salvar(1, { skus: [{ cor: "Preto", tamanho: "M", sku: "A B" }] })).rejects.toMatchObject({ status: 400 });
    await expect(
      SkuService.salvar(1, { skus: [{ cor: "Preto", tamanho: "M", sku: "IGUAL" }, { cor: "Preto", tamanho: "G", sku: "IGUAL" }] }),
    ).rejects.toMatchObject({ message: expect.stringContaining("mais de uma combinação") });
  });
});

describe("importar da YouDraw", () => {
  it("acha o produto pelo nome e liga as variantes por cor e tamanho (sem acento/caixa)", async () => {
    (listarProdutosYouDraw as jest.Mock).mockResolvedValue([{ id: "yd_p1", name: "camiseta dryfit basic masculina", status: "Ativo" }]);
    (buscarProdutoYouDraw as jest.Mock).mockResolvedValue({
      id: "yd_p1",
      name: "Camiseta DryFit Basic Masculina",
      variants: [
        { id: "v1", sku: "YD-PRETO-M", color: { name: "PRETO", hex: "#000" }, size: "m" },
        { id: "v2", sku: "YD-BRANCO-M", color: { name: "Branco", hex: "#fff" }, size: "M" },
      ],
    });

    const r = await SkuService.importarDaYouDraw(1, {});
    expect(r.associados).toBe(1);
    expect(r.sem_par).toEqual([{ cor: "Preto", tamanho: "G" }]);
    expect(criar).toHaveBeenCalledWith(expect.objectContaining({ cor: "Preto", tamanho: "M", sku: "YD-PRETO-M", id_produto_fornecedor: "yd_p1" }), expect.anything());
  });

  it("nome ambíguo: devolve os candidatos para a equipe escolher", async () => {
    (listarProdutosYouDraw as jest.Mock).mockResolvedValue([{ id: "a", name: "Outro", status: "Ativo" }]);
    const r = await SkuService.importarDaYouDraw(1, {});
    expect(r).toMatchObject({ precisa_escolher: true, candidatos: [{ id: "a", nome: "Outro" }] });
    expect(buscarProdutoYouDraw).not.toHaveBeenCalled();
  });

  it("sem chave da API: 409 explicando", async () => {
    delete process.env.YOUDRAW_API_KEY;
    await expect(SkuService.importarDaYouDraw(1, {})).rejects.toMatchObject({ status: 409 });
  });
});

describe("resolverPares (rota interna)", () => {
  it("devolve o SKU de cada par cor + grade pelo nome da cor e do tamanho", async () => {
    skusDoBanco.push({ id_produto: 1, cor: "Preto", tamanho: "M", sku: "DRY-P-M", id_produto_fornecedor: null });
    (ProdutoCores.findAll as jest.Mock).mockResolvedValue([{ id_produto_cor: 10, id_produto: 1, nome: "Preto" }]);
    (ProdutoGrades.findAll as jest.Mock).mockResolvedValue([{ id_produto_grade: 20, id_produto: 1, nome: "M" }, { id_produto_grade: 21, id_produto: 1, nome: "G" }]);
    const r = await SkuService.resolverPares([{ id_produto_cor: 10, id_produto_grade: 20 }, { id_produto_cor: 10, id_produto_grade: 21 }, { id_produto_cor: 99, id_produto_grade: 20 }]);
    expect(r.map((x) => x.sku)).toEqual(["DRY-P-M", null, null]);
    expect(r[2]).toMatchObject({ cor: null, id_produto: null });
  });
});
