import nodemailer from "nodemailer";
import { chamarServico } from "@agnus/comum/utils/clienteInterno";
import EmailService, { configuracaoSmtp, reiniciarTransporte } from "../../src/email/email.service";
import AvisoPorEmailService from "../../src/email/avisoPorEmail.service";
import { conteudoDaDevolucao, emailDeDevolucao, emailDeStatus } from "../../src/email/modelos";

jest.mock("nodemailer", () => ({ __esModule: true, default: { createTransport: jest.fn() } }));
jest.mock("@agnus/comum/utils/clienteInterno", () => ({ chamarServico: jest.fn() }));
jest.mock("@agnus/comum/utils/logger", () => ({ __esModule: true, default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const sendMail = jest.fn();
const createTransport = nodemailer.createTransport as jest.Mock;
const chamar = chamarServico as jest.Mock;
const AMBIENTE = { ...process.env };

beforeEach(() => {
  process.env = { ...AMBIENTE, SMTP_HOST: "smtp.teste", SMTP_PORT: "587", SMTP_USER: "loja@teste.com", SMTP_PASS: "x", FRONTEND_URL: "https://agnus.fit" };
  delete process.env.EMAIL_EQUIPE;
  delete process.env.EMAIL_FROM;
  delete process.env.SMTP_SECURE;
  reiniciarTransporte();
  sendMail.mockResolvedValue({ messageId: "id-1" });
  createTransport.mockReturnValue({ sendMail });
});

afterAll(() => {
  process.env = AMBIENTE;
});

describe("configuracaoSmtp", () => {
  it("fica desligado sem SMTP_HOST", () => {
    delete process.env.SMTP_HOST;
    expect(configuracaoSmtp()).toBeNull();
  });

  it("usa TLS direto só na porta 465 e o usuário como remetente", () => {
    expect(configuracaoSmtp()).toMatchObject({ port: 587, secure: false, remetente: "Agnus <loja@teste.com>" });
    process.env.SMTP_PORT = "465";
    expect(configuracaoSmtp()).toMatchObject({ secure: true });
  });
});

describe("EmailService.enviar", () => {
  const email = { para: "cliente@teste.com", assunto: "Oi", html: "<p>oi</p>", texto: "oi" };

  it("envia pelo SMTP configurado", async () => {
    await expect(EmailService.enviar(email)).resolves.toBe(true);
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: "cliente@teste.com", subject: "Oi", from: "Agnus <loja@teste.com>" }));
  });

  it("não envia sem SMTP e não lança quando o servidor falha", async () => {
    delete process.env.SMTP_HOST;
    await expect(EmailService.enviar(email)).resolves.toBe(false);
    expect(sendMail).not.toHaveBeenCalled();

    process.env.SMTP_HOST = "smtp.teste";
    sendMail.mockRejectedValueOnce(new Error("conexão recusada"));
    await expect(EmailService.enviar(email)).resolves.toBe(false);
  });
});

describe("modelos", () => {
  it("monta o e-mail de pagamento confirmado com nome e link", () => {
    const email = emailDeStatus({ nome: "Maria Silva", email: "maria@teste.com" }, 42, "pago", 139.8)!;
    expect(email.assunto).toBe("Recebemos seu pagamento - pedido #42");
    expect(email.html).toContain("Total do pedido: <strong>R$");
    expect(email.texto).toMatch(/Total do pedido: R\$\s?139,80/);
    expect(email.html).toContain("Olá, Maria!");
    expect(email.html).toContain("https://agnus.fit/cliente/pedidos?pedido=42");
    expect(email.texto).toContain("O pagamento do pedido #42 foi confirmado.");
  });

  it("leva ao pagamento quando o pedido aguarda pagamento", () => {
    expect(emailDeStatus({ email: "a@b.com" }, 7, "aguardando_pagamento")!.html).toContain("https://agnus.fit/pagamento/7");
  });

  it("escapa HTML vindo do nome do cliente", () => {
    const email = emailDeStatus({ nome: "<script>x</script>", email: "a@b.com" }, 1, "enviado")!;
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
  });

  it("mostra a linha do tempo com a etapa atual e sem valor quando não informado", () => {
    const email = emailDeStatus({ email: "a@b.com" }, 5, "enviado")!;
    expect(email.html).toContain("Envio");
    expect(email.html).toContain("Entrega");
    expect(email.html).not.toContain("Total do pedido");
  });

  it("não tem e-mail para status sem aviso", () => {
    expect(emailDeStatus({ email: "a@b.com" }, 1, "aguardando_calculo_frete")).toBeNull();
  });
});

describe("AvisoPorEmailService", () => {
  it("busca o e-mail do cliente na identidade e envia o aviso", async () => {
    chamar.mockResolvedValue({ status: 200, data: { id_usuario: 3, nome: "Ana", email: "ana@teste.com" } });
    await AvisoPorEmailService.statusDoPedido({ id_usuario: 3, id_pedido: 9, status: "enviado" });
    expect(chamar).toHaveBeenCalledWith("identidade", "/usuarios/3", expect.anything());
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: "ana@teste.com", subject: "Seu pedido #9 saiu para entrega" }));
  });

  it("avisa a equipe quando o pedido é pago", async () => {
    process.env.EMAIL_EQUIPE = "vendas@teste.com, invalido, producao@teste.com";
    chamar.mockResolvedValue({ status: 200, data: { id_usuario: 3, email: "ana@teste.com" } });
    await AvisoPorEmailService.statusDoPedido({ id_usuario: 3, id_pedido: 9, status: "pago" });
    const destinos = sendMail.mock.calls.map(([m]) => m.to);
    expect(destinos).toEqual(["ana@teste.com", "vendas@teste.com", "producao@teste.com"]);
  });

  it("não envia nada ao cliente se a identidade estiver fora do ar", async () => {
    chamar.mockRejectedValue(new Error("503"));
    await expect(AvisoPorEmailService.statusDoPedido({ id_usuario: 3, id_pedido: 9, status: "pago" })).resolves.toBeUndefined();
    expect(sendMail).not.toHaveBeenCalled();
  });
});

describe("avisos de devolução", () => {
  const base = { id_pedido: 42, id_devolucao: 3, valor_reembolso: 69.9 };

  it("aprovada leva as instruções e o código de postagem", () => {
    const email = emailDeDevolucao({ nome: "Ana", email: "ana@teste.com" }, { ...base, status: "aprovada", resposta_loja: "Poste nos Correios", codigo_postagem: "AB123" })!;
    expect(email.assunto).toBe("Devolução aprovada - pedido #42");
    expect(email.texto).toContain("Como enviar: Poste nos Correios");
    expect(email.texto).toContain("Código de postagem: AB123");
    expect(email.html).toContain("https://agnus.fit/cliente/pedidos?pedido=42");
  });

  it("recusada mostra o motivo e reembolsada mostra o valor", () => {
    expect(emailDeDevolucao({ email: "a@b.com" }, { ...base, status: "recusada", resposta_loja: "Peça usada" })!.texto).toContain("Motivo: Peça usada");
    expect(emailDeDevolucao({ email: "a@b.com" }, { ...base, status: "reembolsada" })!.texto).toMatch(/reembolso de R\$\s?69,90/);
  });

  it("aviso do site cabe em 255 caracteres em todas as etapas", () => {
    for (const status of ["solicitada", "aprovada", "recusada", "recebida", "reembolsada", "cancelada"] as const) {
      const c = conteudoDaDevolucao({ ...base, status })!;
      expect(c.mensagem.length).toBeLessThanOrEqual(255);
      expect(c.titulo.length).toBeLessThanOrEqual(120);
    }
  });
});
