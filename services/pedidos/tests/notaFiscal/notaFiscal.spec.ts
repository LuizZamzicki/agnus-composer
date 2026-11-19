import { promises as fs } from "fs";
import { chamarServico } from "@agnus/comum/utils/clienteInterno";
import Pedidos from "../../src/models/Pedidos";
import NotaFiscalService, { NotasFiscais } from "../../src/notaFiscal/notaFiscal.service";
import { chaveValida, digitoDaChave, formatarChave, lerXmlDaNota } from "../../src/notaFiscal/notaFiscal.regras";

jest.mock("@agnus/comum/utils/logger", () => ({ __esModule: true, default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock("@agnus/comum/utils/clienteInterno", () => ({ chamarServico: jest.fn() }));
jest.mock("../../src/models/Pedidos", () => ({ __esModule: true, default: { findByPk: jest.fn() } }));

// Chave de exemplo com o dígito verificador certo.
const base43 = "4124110000000000000000550010000001231000000";
const CHAVE = `${base43}${digitoDaChave(base43)}`;
const XML = `<?xml version="1.0" encoding="UTF-8"?><nfeProc versao="4.00"><NFe><infNFe Id="NFe${CHAVE}"><ide><serie>1</serie><nNF>123</nNF><dhEmi>2026-11-17T10:30:00-03:00</dhEmi></ide><total><ICMSTot><vNF>159.80</vNF></ICMSTot></total></infNFe></NFe><protNFe><infProt><chNFe>${CHAVE}</chNFe></infProt></protNFe></nfeProc>`;
const PDF = Buffer.from("%PDF-1.4\n%fake\n").toString("base64");
const b64 = (texto: string) => Buffer.from(texto).toString("base64");

const pedido = (dados = {}) => ({ id_pedido: 7, id_usuario: 3, status: "pago", ...dados });
const cliente = { id_usuario: 3, email: "c@a.com", tipo: "cliente" } as never;
const outro = { id_usuario: 9, email: "o@a.com", tipo: "cliente" } as never;
const admin = { id_usuario: 1, email: "a@a.com", tipo: "administrador" } as never;

const findPedido = Pedidos.findByPk as jest.Mock;
const findNota = jest.spyOn(NotasFiscais, "findByPk");
const criar = jest.spyOn(NotasFiscais, "create");
const listar = jest.spyOn(NotasFiscais, "findAll");

describe("regras da NF-e", () => {
  it("confere o dígito verificador da chave de acesso", () => {
    expect(chaveValida(CHAVE)).toBe(true);
    expect(chaveValida(`${base43}${(digitoDaChave(base43) + 1) % 10}`)).toBe(false);
    expect(chaveValida("123")).toBe(false);
    expect(formatarChave(CHAVE).split(" ")).toHaveLength(11);
  });

  it("lê chave, número, série, emissão e valor do XML autorizado", () => {
    expect(lerXmlDaNota(XML)).toEqual({ chave: CHAVE, numero: "123", serie: "1", data_emissao: new Date("2026-11-17T13:30:00Z"), valor: 159.8 });
    expect(lerXmlDaNota(`<NFe><infNFe Id="NFe${CHAVE}"></infNFe></NFe>`).chave).toBe(CHAVE);
  });
});

describe("NotaFiscalService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(fs, "mkdir").mockResolvedValue(undefined);
    jest.spyOn(fs, "writeFile").mockResolvedValue(undefined);
    jest.spyOn(fs, "unlink").mockResolvedValue(undefined);
    (chamarServico as jest.Mock).mockResolvedValue({ status: 204, data: null });
  });

  it("equipe anexa o XML e o PDF: dados vêm do XML e o cliente é avisado", async () => {
    findPedido.mockResolvedValue(pedido());
    findNota.mockResolvedValueOnce(null).mockResolvedValueOnce({ chave: CHAVE, numero: "123", serie: "1", data_emissao: null, valor: "159.80", arquivo_pdf: "a.pdf", arquivo_xml: "b.xml" } as never);
    criar.mockResolvedValue({} as never);

    const resumo = await NotaFiscalService.salvar(7, { xml: b64(XML), pdf: PDF });

    expect(criar).toHaveBeenCalledWith(expect.objectContaining({ id_pedido: 7, chave: CHAVE, numero: "123", serie: "1", valor: 159.8 }));
    expect(fs.writeFile).toHaveBeenCalledTimes(2);
    expect(resumo).toMatchObject({ chave: CHAVE, numero: "123", tem_pdf: true, tem_xml: true });
    expect(chamarServico).toHaveBeenCalledWith("notificacoes", "/nota-fiscal", expect.objectContaining({ body: { id_usuario: 3, id_pedido: 7 } }));
  });

  it("trocar o PDF apaga o arquivo antigo do disco, não o novo, e não avisa o cliente de novo", async () => {
    findPedido.mockResolvedValue(pedido());
    const registro = {
      chave: CHAVE, numero: "123", serie: "1", data_emissao: null, valor: null,
      arquivo_pdf: "11111111-1111-1111-1111-111111111111.pdf", arquivo_xml: "22222222-2222-2222-2222-222222222222.xml",
      update: jest.fn(async function (this: Record<string, unknown>, dados: Record<string, unknown>) { Object.assign(this, dados); }),
    };
    findNota.mockResolvedValue(registro as never);

    await NotaFiscalService.salvar(7, { pdf: PDF });

    const novo = registro.arquivo_pdf;
    expect(novo).not.toBe("11111111-1111-1111-1111-111111111111.pdf");
    const apagados = (fs.unlink as unknown as jest.Mock).mock.calls.map(([c]) => String(c));
    expect(apagados).toHaveLength(1);
    expect(apagados[0]).toContain("11111111-1111-1111-1111-111111111111.pdf");
    expect(registro.arquivo_xml).toBe("22222222-2222-2222-2222-222222222222.xml");
    expect(chamarServico).not.toHaveBeenCalled();
  });

  it("recusa chave inválida, chave diferente do XML, arquivo que não é PDF e pedido sem pagamento", async () => {
    findPedido.mockResolvedValue(pedido());
    findNota.mockResolvedValue(null);
    await expect(NotaFiscalService.salvar(7, { chave: "123", pdf: PDF })).rejects.toMatchObject({ status: 400 });
    await expect(NotaFiscalService.salvar(7, { chave: `${base43}0`.replace(/.$/, String((digitoDaChave(base43) + 1) % 10)), xml: b64(XML) })).rejects.toMatchObject({ status: 400 });
    await expect(NotaFiscalService.salvar(7, { chave: CHAVE, pdf: b64("não é pdf") })).rejects.toMatchObject({ status: 400 });
    await expect(NotaFiscalService.salvar(7, { chave: CHAVE })).rejects.toMatchObject({ status: 400 });

    findPedido.mockResolvedValue(pedido({ status: "aguardando_pagamento" }));
    await expect(NotaFiscalService.salvar(7, { chave: CHAVE, pdf: PDF })).rejects.toMatchObject({ status: 409 });
    expect(criar).not.toHaveBeenCalled();
  });

  it("só o dono do pedido ou a equipe veem a nota; para os outros, 404", async () => {
    findPedido.mockResolvedValue(pedido());
    findNota.mockResolvedValue({ chave: CHAVE, numero: "123", serie: "1", data_emissao: null, valor: null, arquivo_pdf: "0f1e2d3c-4b5a-4697-8877-665544332211.pdf", arquivo_xml: null } as never);

    expect(await NotaFiscalService.daPedido(7, cliente)).toMatchObject({ numero: "123", tem_pdf: true, tem_xml: false });
    expect(await NotaFiscalService.daPedido(7, admin)).toMatchObject({ numero: "123" });
    await expect(NotaFiscalService.daPedido(7, outro)).rejects.toMatchObject({ status: 404 });

    const pdf = await NotaFiscalService.arquivo(7, "pdf", cliente);
    expect(pdf).toMatchObject({ tipo: "application/pdf", nome: "NF-e-123-pedido-7.pdf" });
    await expect(NotaFiscalService.arquivo(7, "xml", cliente)).rejects.toMatchObject({ status: 404 });
  });

  it("pedido sem nota: 404 com mensagem para o cliente; resumos em lote para as listas", async () => {
    findPedido.mockResolvedValue(pedido());
    findNota.mockResolvedValue(null);
    await expect(NotaFiscalService.daPedido(7, cliente)).rejects.toMatchObject({ status: 404, message: "A nota fiscal deste pedido ainda não foi emitida." });

    listar.mockResolvedValue([{ id_pedido: 7, chave: CHAVE, numero: "123", arquivo_pdf: "x.pdf", arquivo_xml: null } as never]);
    const mapa = await NotaFiscalService.resumos([7, 8]);
    expect(mapa.get(7)).toMatchObject({ numero: "123", tem_pdf: true });
    expect(mapa.has(8)).toBe(false);
  });
});
