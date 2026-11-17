import FreteService from "../../src/frete/frete.service";
import { cotarPelaTabela, montarOpcoes, normalizarCep, pesoDoPacote, ufDoCep, zonaEntre } from "../../src/frete/frete.regras";
import { cotarMelhorEnvio } from "../../src/frete/melhorEnvio";

jest.mock("../../src/frete/melhorEnvio", () => {
  const real = jest.requireActual("../../src/frete/melhorEnvio");
  return { __esModule: true, ...real, cotarMelhorEnvio: jest.fn() };
});

const melhorEnvio = cotarMelhorEnvio as jest.Mock;

describe("regras do frete", () => {
  it("descobre o estado pelo CEP (com ou sem traço) e recusa CEP inválido", () => {
    expect(normalizarCep("87013-000")).toBe("87013000");
    expect(ufDoCep("87013000")).toBe("PR");
    expect(ufDoCep("01310100")).toBe("SP");
    expect(ufDoCep("69900000")).toBe("AC");
    expect(ufDoCep("70040010")).toBe("DF");
    expect(ufDoCep("00000000")).toBeNull();
    expect(ufDoCep("1234")).toBeNull();
  });

  it("distância: mesmo estado, mesma região, região vizinha e longe", () => {
    expect(zonaEntre("PR", "PR")).toBe("local");
    expect(zonaEntre("PR", "SC")).toBe("regional");
    expect(zonaEntre("PR", "SP")).toBe("proxima");
    expect(zonaEntre("PR", "AM")).toBe("distante");
  });

  it("tabela: PAC e SEDEX, com valor a mais por kg acima de 1 kg", () => {
    expect(cotarPelaTabela("PR", "PR", pesoDoPacote(3, 0.3))).toEqual([
      { id: "pac", nome: "PAC", empresa: "Correios", preco_cheio: 19.9, prazo_dias: 4 },
      { id: "sedex", nome: "SEDEX", empresa: "Correios", preco_cheio: 29.9, prazo_dias: 2 },
    ]);
    // 8 peças = 2,4 kg → 2 kg a mais
    expect(cotarPelaTabela("PR", "PR", pesoDoPacote(8, 0.3))[0].preco_cheio).toBe(26.9);
  });

  it("frete grátis: a mais barata sai de graça e as outras custam a diferença; soma os dias de produção", () => {
    const opcoes = montarOpcoes(
      [
        { id: "sedex", nome: "SEDEX", empresa: "Correios", preco_cheio: 29.9, prazo_dias: 2 },
        { id: "pac", nome: "PAC", empresa: "Correios", preco_cheio: 19.9, prazo_dias: 4 },
      ],
      { freteGratis: true, diasProducao: 5 },
    );
    expect(opcoes.map((o) => [o.id, o.preco, o.gratis, o.prazo_dias])).toEqual([["pac", 0, true, 9], ["sedex", 10, false, 7]]);
  });
});

describe("FreteService.cotar", () => {
  const envOriginal = { ...process.env };

  beforeEach(() => {
    FreteService.limparCache();
    melhorEnvio.mockReset();
    process.env = { ...envOriginal, FRETE_CEP_ORIGEM: "87010000", MELHOR_ENVIO_TOKEN: "", FRETE_DIAS_PRODUCAO: "" };
  });

  afterAll(() => {
    process.env = envOriginal;
  });

  it("sem token do Melhor Envio usa a tabela da loja", async () => {
    const cotacao = await FreteService.cotar("01310-100", 2, 120);
    expect(cotacao).toMatchObject({ cep: "01310100", uf: "SP", origem: "tabela", frete_gratis: false, frete_gratis_acima: 250 });
    expect(cotacao.opcoes.map((o) => [o.id, o.preco])).toEqual([["pac", 29.9], ["sedex", 54.9]]);
    expect(melhorEnvio).not.toHaveBeenCalled();
  });

  it("com token usa o Melhor Envio; se ele falhar, cai na tabela", async () => {
    process.env.MELHOR_ENVIO_TOKEN = "token-teste";
    melhorEnvio.mockResolvedValueOnce([
      { id: "me-2", nome: "SEDEX", empresa: "Correios", preco_cheio: 31.2, prazo_dias: 2 },
      { id: "me-3", nome: ".Package", empresa: "Jadlog", preco_cheio: 18.4, prazo_dias: 5 },
    ]);
    const real = await FreteService.cotar("80010000", 1, 100);
    expect(real.origem).toBe("melhor_envio");
    expect(real.opcoes.map((o) => o.id)).toEqual(["me-3", "me-2"]);
    expect(melhorEnvio).toHaveBeenCalledWith({ cepOrigem: "87010000", cepDestino: "80010000", pecas: 1, pesoPorPecaKg: 0.3, valorPecas: 100 });

    melhorEnvio.mockRejectedValueOnce(new Error("fora do ar"));
    expect((await FreteService.cotar("80020000", 1, 100)).origem).toBe("tabela");
  });

  it("guarda a cotação por alguns minutos (não chama de novo para o mesmo CEP e sacola)", async () => {
    process.env.MELHOR_ENVIO_TOKEN = "token-teste";
    melhorEnvio.mockResolvedValue([{ id: "me-1", nome: "PAC", empresa: "Correios", preco_cheio: 20, prazo_dias: 6 }]);
    await FreteService.cotar("80010000", 1, 100);
    await FreteService.cotar("80010-000", 1, 100);
    expect(melhorEnvio).toHaveBeenCalledTimes(1);
  });

  it("CEP inválido: 400", async () => {
    await expect(FreteService.cotar("123", 1, 10)).rejects.toMatchObject({ status: 400 });
  });

  it("escolher: opção pedida, a mais barata quando não pede, e 409 para opção que não existe", async () => {
    expect((await FreteService.escolher("87013000", 1, 100, "sedex")).opcao).toMatchObject({ id: "sedex", preco: 29.9 });
    expect((await FreteService.escolher("87013000", 1, 100, null)).opcao.id).toBe("pac");
    await expect(FreteService.escolher("87013000", 1, 100, "me-9")).rejects.toMatchObject({ status: 409 });
  });
});
