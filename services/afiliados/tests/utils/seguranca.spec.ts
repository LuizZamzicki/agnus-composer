import {
  assinarReferencia,
  assinaturaConfere,
  calcularAssinatura,
  cifrar,
  decifrar,
  gerarCodigo,
  hashDoIp,
  lerCabecalhoAssinatura,
  lerReferencia,
} from "../../src/utils/seguranca";

beforeAll(() => {
  process.env.AFILIADOS_SEGREDO = "segredo-de-teste-com-mais-de-32-caracteres!!";
});

describe("cookie do clique", () => {
  const futuro = Math.floor(Date.now() / 1000) + 3600;

  it("lê de volta o clique assinado", () => {
    const ref = assinarReferencia(42, futuro);
    expect(lerReferencia(ref)).toEqual({ idClique: 42, expiraEm: new Date(futuro * 1000) });
  });

  it("recusa clique adulterado, expirado ou malformado", () => {
    const ref = assinarReferencia(42, futuro);
    expect(lerReferencia(ref.replace(/^42\./, "43."))).toBeNull();
    expect(lerReferencia(assinarReferencia(42, Math.floor(Date.now() / 1000) - 1))).toBeNull();
    expect(lerReferencia("42.123")).toBeNull();
    expect(lerReferencia(undefined)).toBeNull();
  });

  it("assinatura muda com o segredo do servidor", () => {
    const ref = assinarReferencia(42, futuro);
    process.env.AFILIADOS_SEGREDO = "outro-segredo-totalmente-diferente-1234567890";
    expect(lerReferencia(ref)).toBeNull();
    process.env.AFILIADOS_SEGREDO = "segredo-de-teste-com-mais-de-32-caracteres!!";
  });
});

describe("segredo da API cifrado", () => {
  it("cifra com IV aleatório e decifra", () => {
    const a = cifrar("meu-segredo");
    expect(a).not.toContain("meu-segredo");
    expect(cifrar("meu-segredo")).not.toBe(a);
    expect(decifrar(a)).toBe("meu-segredo");
  });

  it("não aceita texto cifrado adulterado", () => {
    const partes = cifrar("meu-segredo").split(":");
    partes[3] = Buffer.from("xxxx").toString("base64url");
    expect(() => decifrar(partes.join(":"))).toThrow();
  });
});

describe("assinatura estilo Shopee", () => {
  it("SHA256(AppId + Timestamp + Payload + Segredo)", () => {
    // sha256("123" + "1700000000" + '{"a":1}' + "s") calculado de forma independente
    const esperado = require("crypto").createHash("sha256").update('1231700000000{"a":1}s').digest("hex");
    expect(calcularAssinatura("123", "1700000000", '{"a":1}', "s")).toBe(esperado);
  });

  it("lê o cabeçalho Authorization", () => {
    expect(lerCabecalhoAssinatura("SHA256 Credential=123, Timestamp=1700000000, Signature=ABCdef")).toEqual({
      appId: "123",
      timestamp: "1700000000",
      assinatura: "abcdef",
    });
    expect(lerCabecalhoAssinatura("Bearer xyz")).toBeNull();
    expect(lerCabecalhoAssinatura("SHA256 Credential=123")).toBeNull();
  });

  it("compara em tempo constante sem quebrar com tamanhos diferentes", () => {
    expect(assinaturaConfere("abc", "abc")).toBe(true);
    expect(assinaturaConfere("abc", "abcd")).toBe(false);
  });
});

describe("utilitários", () => {
  it("gera códigos sem caracteres ambíguos", () => {
    const codigo = gerarCodigo(200);
    expect(codigo).toMatch(/^[a-z2-9]+$/);
    expect(codigo).not.toMatch(/[01ilo]/);
  });

  it("nunca guarda o IP em claro", () => {
    expect(hashDoIp("200.1.2.3")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashDoIp("200.1.2.3")).not.toContain("200.1.2.3");
    expect(hashDoIp(undefined)).toBeNull();
  });
});
