import sequelize from "@agnus/comum/config/database";
import { chamarServico } from "@agnus/comum/utils/clienteInterno";
import { consultarSelecoes } from "@agnus/comum/utils/itemDetails";
import CarrinhoItens from "../src/models/CarrinhoItens";
import Carrinhos from "../src/models/Carrinhos";
import LembreteSacolaService, { proximoLembrete, type SacolaParada } from "../src/services/lembreteSacola.service";

jest.mock("@agnus/comum/config/database", () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock("@agnus/comum/utils/clienteInterno", () => ({ __esModule: true, chamarServico: jest.fn() }));
jest.mock("@agnus/comum/utils/itemDetails", () => ({ __esModule: true, consultarSelecoes: jest.fn() }));
jest.mock("../src/models/CarrinhoItens", () => ({ __esModule: true, default: { findAll: jest.fn() } }));
jest.mock("../src/models/Carrinhos", () => ({ __esModule: true, default: { update: jest.fn(), findOne: jest.fn() } }));

const HORA = 60 * 60 * 1000;
const AGORA = new Date("2026-11-19T15:00:00Z").getTime();
const haHoras = (horas: number) => new Date(AGORA - horas * HORA);

const sacola = (extra: Partial<SacolaParada> = {}): SacolaParada => ({
  id_carrinho: 3,
  id_usuario: 7,
  lembretes_enviados: 0,
  lembrete_em: null,
  token_lembrete: null,
  ultima_mudanca: haHoras(2),
  ...extra,
});

const mocks = {
  query: sequelize.query as unknown as jest.Mock,
  chamar: chamarServico as unknown as jest.Mock,
  selecoes: consultarSelecoes as unknown as jest.Mock,
  itens: CarrinhoItens.findAll as unknown as jest.Mock,
  update: Carrinhos.update as unknown as jest.Mock,
  findOne: Carrinhos.findOne as unknown as jest.Mock,
};

const contexto = (ativo = true) => ({
  contexto: {
    produto: { id_produto: 11, nome: "Camiseta Fé", ativo },
    cor: { nome: "Preta" },
    grade: { nome: "M" },
    foto: "produto_fotos/a.jpg",
    precoUnitario: 89.9,
  },
});

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.chamar.mockResolvedValue({ status: 204, data: null });
  mocks.itens.mockResolvedValue([{ id_produto_cor: 1, id_produto_grade: 2, quantidade: 2 }]);
  mocks.selecoes.mockResolvedValue([contexto()]);
});

describe("proximoLembrete", () => {
  it("primeiro lembrete uma hora depois da última mudança", () => {
    expect(proximoLembrete(sacola({ ultima_mudanca: haHoras(0.5) }), AGORA)).toBeNull();
    expect(proximoLembrete(sacola({ ultima_mudanca: haHoras(1) }), AGORA)).toBe(1);
  });

  it("segundo lembrete só 24 horas depois da mudança", () => {
    const enviado = { lembretes_enviados: 1, lembrete_em: haHoras(1) };
    expect(proximoLembrete(sacola({ ...enviado, ultima_mudanca: haHoras(2) }), AGORA)).toBeNull();
    expect(proximoLembrete(sacola({ ...enviado, ultima_mudanca: haHoras(24) }), AGORA)).toBe(2);
  });

  it("depois do segundo, não manda mais", () => {
    expect(proximoLembrete(sacola({ lembretes_enviados: 2, lembrete_em: haHoras(1), ultima_mudanca: haHoras(48) }), AGORA)).toBeNull();
  });

  it("mexer na sacola depois do lembrete recomeça a contagem", () => {
    expect(proximoLembrete(sacola({ lembretes_enviados: 2, lembrete_em: haHoras(30), ultima_mudanca: haHoras(3) }), AGORA)).toBe(1);
  });

  it("sacola parada há mais de uma semana fica de fora", () => {
    expect(proximoLembrete(sacola({ ultima_mudanca: haHoras(24 * 8) }), AGORA)).toBeNull();
  });
});

describe("LembreteSacolaService.rodar", () => {
  it("manda as peças da sacola para o e-mail e marca o lembrete", async () => {
    mocks.query.mockResolvedValueOnce([sacola()]);

    const resultado = await LembreteSacolaService.rodar(new Date(AGORA));

    expect(mocks.chamar).toHaveBeenCalledWith("notificacoes", "/sacola-esquecida", expect.objectContaining({
      body: expect.objectContaining({
        id_usuario: 7,
        etapa: 1,
        token: expect.stringMatching(/^[0-9a-f-]{36}$/),
        pecas: [{ id_produto: 11, nome: "Camiseta Fé", cor: "Preta", tamanho: "M", foto: "produto_fotos/a.jpg", preco: 179.8 }],
      }),
    }));
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ lembretes_enviados: 1, lembrete_em: new Date(AGORA) }),
      { where: { id_carrinho: 3 } },
    );
    expect(resultado).toEqual({ verificados: 1, enviados: 1 });
  });

  it("mantém o mesmo código de cancelamento da sacola", async () => {
    const token = "0b7a3c1e-1111-4222-8333-944455556666";
    mocks.query.mockResolvedValueOnce([sacola({ token_lembrete: token })]);
    await LembreteSacolaService.rodar(new Date(AGORA));
    expect(mocks.chamar.mock.calls[0][2].body.token).toBe(token);
  });

  it("peça que saiu do catálogo não vai no e-mail; sem peças, não manda e não tenta de novo", async () => {
    mocks.query.mockResolvedValueOnce([sacola()]);
    mocks.selecoes.mockResolvedValueOnce([contexto(false)]);

    const resultado = await LembreteSacolaService.rodar(new Date(AGORA));

    expect(mocks.chamar).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalled();
    expect(resultado.enviados).toBe(0);
  });

  it("falha no envio deixa para a próxima rodada", async () => {
    mocks.query.mockResolvedValueOnce([sacola()]);
    mocks.chamar.mockRejectedValueOnce(new Error("fora do ar"));

    await LembreteSacolaService.rodar(new Date(AGORA));

    expect(mocks.update).not.toHaveBeenCalled();
  });
});

describe("LembreteSacolaService.cancelar", () => {
  it("guarda o usuário da sacola do link", async () => {
    mocks.findOne.mockResolvedValueOnce({ id_usuario: 7 });
    await LembreteSacolaService.cancelar("0b7a3c1e-1111-4222-8333-944455556666");
    expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining("sacola_lembretes_cancelados"), { replacements: { id: 7 } });
  });

  it("link inválido ou desconhecido", async () => {
    await expect(LembreteSacolaService.cancelar("x")).rejects.toMatchObject({ status: 400 });
    mocks.findOne.mockResolvedValueOnce(null);
    await expect(LembreteSacolaService.cancelar("0b7a3c1e-1111-4222-8333-944455556666")).rejects.toMatchObject({ status: 404 });
  });
});
