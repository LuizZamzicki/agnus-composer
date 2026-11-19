import { chamarServico } from "@agnus/comum/utils/clienteInterno";
import Pedidos from "../../src/models/Pedidos";
import OfertasService, { OfertasInscricoes, gerarCupom, normalizarCupom, resumoDaCompra } from "../../src/services/ofertas.service";
import { fatorPago } from "../../src/services/pedidoRegras.service";
import { DESCONTO_PIX, valorNoPix } from "../../src/services/ofertas.regras";

jest.mock("@agnus/comum/utils/clienteInterno", () => ({ __esModule: true, chamarServico: jest.fn() }));
jest.mock("../../src/models/Pedidos", () => ({ __esModule: true, default: { count: jest.fn() } }));

const contar = Pedidos.count as unknown as jest.Mock;
const chamar = chamarServico as unknown as jest.Mock;

describe("Ofertas e cupom de primeira compra", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    contar.mockReset();
    chamar.mockReset().mockResolvedValue({ status: 202, data: null });
  });

  it("gera códigos legíveis e normaliza o que o cliente digita", () => {
    const codigo = gerarCupom();
    expect(codigo).toMatch(/^AGNUS10-[A-HJ-KM-NP-Z2-9]{6}$/);
    expect(normalizarCupom("  agnus10-ab cd ")).toBe("AGNUS10-ABCD");
  });

  it("resumo: 10% de desconto sobre as peças", () => {
    expect(resumoDaCompra(260, 0)).toEqual({ subtotal: 260, desconto: 0, total: 260 });
    expect(resumoDaCompra(260, 10)).toEqual({ subtotal: 260, desconto: 26, total: 234 });
  });

  it("parte paga de cada peça com cupom (reembolso e comissão)", () => {
    expect(fatorPago({ valor_desconto: 0 }, [{ subtotal: 100 }])).toBe(1);
    expect(fatorPago({ valor_desconto: "15.00" }, [{ subtotal: 100 }, { subtotal: 50 }])).toBeCloseTo(0.9);
  });

  it("inscrição nova: grava, devolve o cupom e pede o e-mail de boas-vindas", async () => {
    jest.spyOn(OfertasInscricoes, "findOne").mockResolvedValue(null);
    const criar = jest.spyOn(OfertasInscricoes, "create").mockImplementation(async (dados) => ({ id_inscricao: 1, ...dados }) as never);

    const { inscricao, nova } = await OfertasService.inscrever("  Ana@Exemplo.com ");

    expect(nova).toBe(true);
    expect(criar.mock.calls[0][0]).toMatchObject({ email: "ana@exemplo.com", origem: "home" });
    expect(inscricao.cupom_codigo).toMatch(/^AGNUS10-/);
    expect(chamar).toHaveBeenCalledWith("notificacoes", "/ofertas/boas-vindas", expect.objectContaining({ body: expect.objectContaining({ email: "ana@exemplo.com", percentual: 10 }) }));
  });

  it("e-mail já inscrito devolve o mesmo cupom sem mandar outro e-mail; inválido é recusado", async () => {
    jest.spyOn(OfertasInscricoes, "findOne").mockResolvedValue({ ativo: true, cupom_codigo: "AGNUS10-AAAAAA" } as never);

    const { inscricao, nova } = await OfertasService.inscrever("ana@exemplo.com");

    expect(nova).toBe(false);
    expect(inscricao.cupom_codigo).toBe("AGNUS10-AAAAAA");
    expect(chamar).not.toHaveBeenCalled();
    await expect(OfertasService.inscrever("sem-arroba")).rejects.toMatchObject({ status: 400 });
  });

  it("cancelar: desativa pela chave do link e esconde o e-mail na resposta", async () => {
    const update = jest.fn();
    jest.spyOn(OfertasInscricoes, "findOne").mockResolvedValue({ ativo: true, email: "ana@exemplo.com", update } as never);

    await expect(OfertasService.cancelar("12345678-1234-1234-1234-123456789abc")).resolves.toEqual({ email: "a***@exemplo.com" });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ ativo: false }));
    await expect(OfertasService.cancelar("../x")).rejects.toMatchObject({ status: 400 });
  });

  describe("validarCupom", () => {
    beforeEach(() => {
      jest.spyOn(OfertasInscricoes, "findOne").mockResolvedValue({ cupom_codigo: "AGNUS10-ABCDEF" } as never);
    });

    it("vale na primeira compra", async () => {
      contar.mockResolvedValue(0);
      await expect(OfertasService.validarCupom(5, "agnus10-abcdef")).resolves.toEqual({ codigo: "AGNUS10-ABCDEF", percentual: 10 });
    });

    it("recusa cupom já usado em pedido não cancelado", async () => {
      contar.mockResolvedValueOnce(1).mockResolvedValue(0);
      await expect(OfertasService.validarCupom(5, "AGNUS10-ABCDEF")).rejects.toMatchObject({ status: 409, message: "Este cupom já foi usado." });
    });

    it("recusa quem já comprou ou já tem outro cupom em pedido aberto", async () => {
      contar.mockResolvedValueOnce(0).mockResolvedValueOnce(1).mockResolvedValueOnce(0);
      await expect(OfertasService.validarCupom(5, "AGNUS10-ABCDEF")).rejects.toMatchObject({ status: 409, message: "Este cupom vale só para a primeira compra." });

      contar.mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(1);
      await expect(OfertasService.validarCupom(5, "AGNUS10-ABCDEF")).rejects.toMatchObject({ status: 409 });
    });

    it("código inexistente ou vazio", async () => {
      jest.spyOn(OfertasInscricoes, "findOne").mockResolvedValue(null);
      await expect(OfertasService.validarCupom(5, "NADA")).rejects.toMatchObject({ status: 404 });
      await expect(OfertasService.validarCupom(5, "  ")).rejects.toMatchObject({ status: 400 });
    });
  });
});

describe("Desconto no Pix", () => {
  it("5% a menos sobre o total, arredondado em centavos", () => {
    expect(DESCONTO_PIX).toBe(5);
    expect(valorNoPix(100)).toBe(95);
    expect(valorNoPix(149.9)).toBe(142.4);
  });

  it("entra na parte paga de cada peça junto com o cupom", () => {
    expect(fatorPago({ valor_desconto: "10.00", valor_desconto_pix: "4.50" }, [{ subtotal: 100 }])).toBeCloseTo(0.855);
  });
});
