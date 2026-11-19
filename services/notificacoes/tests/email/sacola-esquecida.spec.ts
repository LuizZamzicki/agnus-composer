import { emailSacolaEsquecida } from "../../src/email/modelos";

const TOKEN = "12345678-1234-1234-1234-123456789abc";
const pecas = [
  { id_produto: 4, nome: "Tank Top <Fé>", cor: "Preta", tamanho: "M", foto: "produto_fotos/tank.jpg", preco: 89.9 },
  { id_produto: 9, nome: "Camiseta", foto: "../../etc/passwd", preco: 120 },
];

describe("E-mail de sacola esquecida", () => {
  beforeEach(() => {
    process.env.FRONTEND_URL = "https://loja.exemplo";
  });

  it("primeiro lembrete: peças, preço, botão para a sacola e link para não receber mais", () => {
    const email = emailSacolaEsquecida({ nome: "Ana Souza", email: "ana@exemplo.com" }, 1, pecas, TOKEN, 5)!;

    expect(email.para).toBe("ana@exemplo.com");
    expect(email.assunto).toBe("Você deixou peças na sacola");
    expect(email.html).toContain("Olá, Ana!");
    expect(email.html).toContain("Tank Top &lt;Fé&gt;");
    expect(email.html).toContain("Preta · M");
    expect(email.html).toContain("https://loja.exemplo/api/produto_fotos/tank.jpg");
    expect(email.html).not.toContain("passwd");
    expect(email.html).toContain("https://loja.exemplo/carrinho");
    expect(email.html).toContain("5% de desconto");
    expect(email.html).toContain(`https://loja.exemplo/sacola/lembretes/cancelar?token=${TOKEN}`);
    expect(email.texto).toContain(`Para não receber mais estes lembretes: https://loja.exemplo/sacola/lembretes/cancelar?token=${TOKEN}`);
  });

  it("segundo lembrete tem outro assunto", () => {
    expect(emailSacolaEsquecida({ email: "ana@exemplo.com" }, 2, pecas, TOKEN, 5)!.assunto).toBe("Suas peças ainda estão na sacola");
  });

  it("sem peças, não há e-mail", () => {
    expect(emailSacolaEsquecida({ email: "ana@exemplo.com" }, 1, [], TOKEN, 5)).toBeNull();
  });
});
