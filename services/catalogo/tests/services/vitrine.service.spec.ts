import { Op } from "sequelize";
import VitrineService, { linkInterno, VitrineBanners } from "../../src/services/vitrine.service";
import { saveProdutoFotoBits } from "../../src/utils/produtoFotoStorage";

jest.mock("@agnus/comum/utils/logger", () => ({ __esModule: true, default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock("../../src/utils/produtoFotoStorage", () => ({ saveProdutoFotoBits: jest.fn() }));

const salvar = saveProdutoFotoBits as jest.Mock;
const criar = jest.spyOn(VitrineBanners, "create").mockImplementation((async (d: object) => ({ id_banner: 7, ...d })) as never);
const buscarTodos = jest.spyOn(VitrineBanners, "findAll");
const buscarUm = jest.spyOn(VitrineBanners, "findByPk");

const foto = (fieldname = "imagem") => ({ fieldname, buffer: Buffer.from("x"), mimetype: "image/jpeg", originalname: "a.jpg" });

beforeEach(() => {
  jest.clearAllMocks();
  salvar.mockResolvedValue("produto_fotos/novo.jpg");
});

describe("linkInterno", () => {
  it("aceita só páginas da loja", () => {
    expect(linkInterno("/catalogo")).toBe("/catalogo");
    expect(linkInterno("/produto/4?cor=preto")).toBe("/produto/4?cor=preto");
    expect(linkInterno("")).toBeNull();
  });

  it("recusa link externo, protocolo e barra dupla", () => {
    for (const ruim of ["https://golpe.com", "//golpe.com", "javascript:alert(1)", "catalogo", "/\\golpe.com"]) {
      expect(() => linkInterno(ruim)).toThrow(/página da loja/);
    }
  });
});

describe("criar", () => {
  it("salva a foto e grava o banner", async () => {
    await VitrineService.criar({ titulo: " Black Friday ", texto_botao: "Ver ofertas", link: "/catalogo", ordem: "2" }, [foto()]);
    expect(salvar).toHaveBeenCalledTimes(1);
    expect(criar).toHaveBeenCalledWith(expect.objectContaining({ titulo: "Black Friday", imagem_url: "produto_fotos/novo.jpg", imagem_mobile_url: null, ordem: 2, ativo: true }));
  });

  it("exige título e foto; botão sem link e fim antes do início são recusados", async () => {
    await expect(VitrineService.criar({}, [foto()])).rejects.toMatchObject({ status: 400 });
    await expect(VitrineService.criar({ titulo: "A" }, [])).rejects.toMatchObject({ message: "Envie a foto do banner." });
    await expect(VitrineService.criar({ titulo: "A", texto_botao: "Ver" }, [foto()])).rejects.toMatchObject({ message: "Informe o link do botão." });
    await expect(
      VitrineService.criar({ titulo: "A", inicio: "2026-11-28T00:00:00Z", fim: "2026-11-27T00:00:00Z" }, [foto()]),
    ).rejects.toMatchObject({ message: "O fim precisa ser depois do início." });
    expect(criar).not.toHaveBeenCalled();
  });

  it("arquivo que não é imagem: 400", async () => {
    salvar.mockResolvedValue(null);
    await expect(VitrineService.criar({ titulo: "A" }, [foto()])).rejects.toMatchObject({ status: 400 });
  });
});

describe("ativos", () => {
  it("só ativos dentro do período, na ordem, no máximo 6", async () => {
    buscarTodos.mockResolvedValue([]);
    const agora = new Date("2026-11-20T12:00:00Z");
    await VitrineService.ativos(agora);
    const opcoes = buscarTodos.mock.calls[0][0] as { where: Record<string | symbol, unknown>; limit: number };
    expect(opcoes.where.ativo).toBe(true);
    expect(JSON.stringify(opcoes.where[Op.and as unknown as string])).toBeDefined();
    expect(opcoes.limit).toBe(6);
  });
});

describe("atualizar", () => {
  it("troca a foto e mantém o resto", async () => {
    const update = jest.fn();
    buscarUm.mockResolvedValue({ id_banner: 3, titulo: "Velho", imagem_url: "produto_fotos/velho.jpg", imagem_mobile_url: null, ordem: 1, ativo: true, inicio: null, fim: null, alinhamento: "centro", foco: "topo", update } as never);
    await VitrineService.atualizar(3, { titulo: "Novo" }, [foto()]);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ titulo: "Novo", imagem_url: "produto_fotos/novo.jpg", alinhamento: "centro", foco: "topo", ordem: 1 }));
  });

  it("banner inexistente: 404", async () => {
    buscarUm.mockResolvedValue(null);
    await expect(VitrineService.atualizar(99, { titulo: "x" })).rejects.toMatchObject({ status: 404 });
  });
});
