import nodemailer from "nodemailer";
import EmailService, { reiniciarTransporte } from "../../src/email/email.service";
import RegistroService, { mascararEmail, RegistroEventos } from "../../src/registro/registro.service";

jest.mock("nodemailer", () => ({ __esModule: true, default: { createTransport: jest.fn() } }));
jest.mock("@agnus/comum/utils/logger", () => ({ __esModule: true, default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const create = jest.spyOn(RegistroEventos, "create");
const findAndCountAll = jest.spyOn(RegistroEventos, "findAndCountAll");
const sendMail = jest.fn();
const AMBIENTE = { ...process.env };

const evento = (type: string, payload: Record<string, unknown>) => ({
  id: "11111111-2222-3333-4444-555555555555",
  type,
  occurredAt: "2026-11-16T15:00:00.000Z",
  source: "agnus-pedidos",
  requestId: "req-1",
  payload,
}) as never;

beforeEach(() => {
  jest.clearAllMocks();
  create.mockResolvedValue({} as never);
  process.env = { ...AMBIENTE, SMTP_HOST: "smtp.teste", SMTP_PORT: "587" };
  reiniciarTransporte();
  (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });
});

afterAll(() => {
  process.env = AMBIENTE;
});

describe("eventos do barramento", () => {
  it("venda: pedido pago vira 'Venda confirmada' na categoria pagamento, com pedido e cliente", async () => {
    await RegistroService.registrarEvento(evento("pedido.atualizado", { id_pedido: 12, id_usuario: 5, status_anterior: "aguardando_pagamento", status: "pago" }));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      tipo: "pedido.atualizado",
      categoria: "pagamento",
      descricao: "Venda confirmada: pagamento do pedido #12 aprovado",
      id_pedido: 12,
      id_usuario: 5,
      event_id: "11111111-2222-3333-4444-555555555555",
      origem: "agnus-pedidos",
      request_id: "req-1",
      ocorrido_em: new Date("2026-11-16T15:00:00.000Z"),
    }));
  });

  it("pedido criado e mudança de status ficam legíveis", async () => {
    await RegistroService.registrarEvento(evento("pedido.criado", { id_pedido: 12, id_usuario: 5, valor_total: 69.9 }));
    expect(create.mock.calls[0][0]).toMatchObject({ categoria: "pedido", descricao: expect.stringMatching(/Pedido #12 criado \(R\$\s?69,90\)/) });
    await RegistroService.registrarEvento(evento("pedido.atualizado", { id_pedido: 12, status_anterior: "pago", status: "enviado" }));
    expect(create.mock.calls[1][0]).toMatchObject({ descricao: "Pedido #12: pago → enviado" });
  });

  it("evento de afiliação e tipo desconhecido também entram", async () => {
    await RegistroService.registrarEvento(evento("afiliado.conversao", { id_pedido: 12, id_afiliado: 3, valor_comissao: 20.97, status: "aguardando_pagamento" }));
    expect(create.mock.calls[0][0]).toMatchObject({ categoria: "afiliado", descricao: expect.stringContaining("afiliado #3") });
    await RegistroService.registrarEvento(evento("algo.novo", {}));
    expect(create.mock.calls[1][0]).toMatchObject({ categoria: "sistema", descricao: "Evento algo.novo" });
    await RegistroService.registrarEvento(evento("afiliado.conversao", { id_pedido: 13, id_afiliado: 3, valor_comissao: 20.97, status: "cancelada" }));
    expect(create.mock.calls[2][0]).toMatchObject({ resultado: "ignorado", descricao: expect.stringContaining("sem comissão") });
  });

  it("o mesmo evento repetido não duplica nem quebra; erro do banco não derruba quem registrou", async () => {
    create.mockRejectedValueOnce(Object.assign(new Error("dup"), { name: "SequelizeUniqueConstraintError" }));
    await expect(RegistroService.registrarEvento(evento("pedido.criado", { id_pedido: 1 }))).resolves.toBeUndefined();
    create.mockRejectedValueOnce(new Error("banco fora"));
    await expect(RegistroService.registrar({ tipo: "x", categoria: "sistema", descricao: "x" })).resolves.toBeUndefined();
  });
});

describe("e-mails no registro", () => {
  const email = { para: "brunomedeiros@gmail.com", assunto: "Recebemos seu pagamento - pedido #12", html: "<p>oi</p>", texto: "oi" };

  it("mascara o e-mail do cliente", () => {
    expect(mascararEmail("brunomedeiros@gmail.com")).toBe("b****@gmail.com");
    expect(mascararEmail("a@b.com")).toBe("a****@b.com");
  });

  it("enviado: registra assunto, destinatário mascarado, pedido e o id da mensagem", async () => {
    sendMail.mockResolvedValue({ messageId: "<abc@agnus>" });
    await EmailService.enviar(email, { id_pedido: 12, id_usuario: 5, destinatario: "cliente" });
    const registro = create.mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(registro).toMatchObject({ tipo: "email.enviado", categoria: "email", resultado: "sucesso", id_pedido: 12, id_usuario: 5 });
    expect(registro.descricao).toBe('E-mail enviado ao cliente (b****@gmail.com): "Recebemos seu pagamento - pedido #12"');
    expect(JSON.stringify(registro)).not.toContain("brunomedeiros@");
    expect(registro.dados).toMatchObject({ messageId: "<abc@agnus>" });
  });

  it("e-mail da equipe diz 'à equipe'", async () => {
    sendMail.mockResolvedValue({ messageId: "<x@agnus>" });
    await EmailService.enviar({ ...email, para: "contato@agnusfit.com" }, { id_pedido: 12, destinatario: "equipe" });
    expect((create.mock.calls[0][0] as unknown as { descricao: string }).descricao).toMatch(/^E-mail enviado à equipe \(c\*\*\*\*@agnusfit\.com\)/);
  });

  it("falha e envio desligado também ficam registrados", async () => {
    sendMail.mockRejectedValue(new Error("535 senha inválida"));
    await EmailService.enviar(email, { id_pedido: 12 });
    expect(create.mock.calls[0][0]).toMatchObject({ tipo: "email.falhou", resultado: "falha", dados: expect.objectContaining({ erro: "535 senha inválida" }) });

    delete process.env.SMTP_HOST;
    await EmailService.enviar(email, { id_pedido: 12 });
    expect(create.mock.calls[1][0]).toMatchObject({ tipo: "email.desativado", resultado: "ignorado" });
  });
});

describe("consulta da equipe", () => {
  it("filtra por pedido, categoria e período (horário de Brasília)", async () => {
    findAndCountAll.mockResolvedValue({ rows: [], count: 0 } as never);
    await RegistroService.listar({ id_pedido: "12", categoria: "email", inicio: "2026-11-16", fim: "2026-11-16", page: "2", limit: "20" });
    const opcoes = findAndCountAll.mock.calls[0][0] as { where: Record<string, unknown>; limit: number; offset: number };
    expect(opcoes.where).toMatchObject({ id_pedido: 12, categoria: "email" });
    expect(opcoes.limit).toBe(20);
    expect(opcoes.offset).toBe(20);
    const periodo = Object.getOwnPropertySymbols(opcoes.where.ocorrido_em as object).map((s) => (opcoes.where.ocorrido_em as Record<symbol, Date>)[s]);
    expect(periodo.map((d) => d.toISOString())).toEqual(["2026-11-16T03:00:00.000Z", "2026-11-17T02:59:59.999Z"]);
  });

  it("recusa filtro inválido", async () => {
    await expect(RegistroService.listar({ id_pedido: "abc" })).rejects.toMatchObject({ status: 400 });
    await expect(RegistroService.listar({ inicio: "16/11/2026" })).rejects.toMatchObject({ status: 400 });
  });
});
