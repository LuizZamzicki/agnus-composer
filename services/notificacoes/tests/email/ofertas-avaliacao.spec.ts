import { emailBoasVindasOfertas, emailNotaFiscal, emailPedirAvaliacao } from "../../src/email/modelos";

describe("E-mails de ofertas e de pedido de avaliação", () => {
  beforeEach(() => {
    process.env.FRONTEND_URL = "https://loja.exemplo";
  });

  it("boas-vindas: mostra o cupom e o link para cancelar a inscrição", () => {
    const email = emailBoasVindasOfertas("ana@exemplo.com", "AGNUS10-ABCDEF", "12345678-1234-1234-1234-123456789abc", 10);

    expect(email.para).toBe("ana@exemplo.com");
    expect(email.assunto).toBe("Seu cupom de 10% na primeira compra");
    expect(email.html).toContain("AGNUS10-ABCDEF");
    expect(email.html).toContain("https://loja.exemplo/ofertas/cancelar?token=12345678-1234-1234-1234-123456789abc");
    expect(email.html).not.toContain("por causa de um pedido");
    expect(email.texto).toContain("Seu cupom: AGNUS10-ABCDEF");
    expect(email.texto).toContain("Para cancelar: https://loja.exemplo/ofertas/cancelar?token=");
  });

  it("pedido de avaliação: um link por peça, que já abre o formulário, com o nome escapado", () => {
    const email = emailPedirAvaliacao({ nome: "Ana Souza", email: "ana@exemplo.com" }, 12, [
      { id_produto: 4, nome: "Tank Top <Machão>" },
      { id_produto: 9, nome: "Camiseta" },
    ])!;

    expect(email.assunto).toBe("Como ficaram as suas peças?");
    expect(email.html).toContain("Olá, Ana!");
    expect(email.html).toContain("https://loja.exemplo/produto/4?avaliar=1#avaliacoes");
    expect(email.html).toContain("Tank Top &lt;Machão&gt;");
    expect(email.texto).toContain("Camiseta: https://loja.exemplo/produto/9?avaliar=1#avaliacoes");
    expect(emailPedirAvaliacao({ email: "ana@exemplo.com" }, 12, [])).toBeNull();
  });
});

describe("e-mail da nota fiscal", () => {
  it("avisa que a NF-e está em Meus pedidos", () => {
    const email = emailNotaFiscal({ nome: "Ana Souza", email: "ana@teste.com" }, 42);
    expect(email.assunto).toBe("Nota fiscal do pedido #42");
    expect(email.html).toContain("/cliente/pedidos");
    expect(email.texto).toContain("Ver nota fiscal");
  });
});
