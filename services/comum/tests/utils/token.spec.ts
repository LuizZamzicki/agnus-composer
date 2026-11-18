import { generateKeyPairSync } from "crypto";
import jwt from "jsonwebtoken";
import { assinarToken, marcaDeSessao, verificarToken } from "../../src/utils/token";

const usuario = { id_usuario: 7, email: "a@a.com", tipo: "cliente" as const, sessao: "s1" };

const paraBase64 = (pem: string) => Buffer.from(pem).toString("base64");

describe("token", () => {
  const ambiente = { ...process.env };

  afterEach(() => {
    process.env = { ...ambiente };
  });

  describe("modo HS256 (sem chaves)", () => {
    beforeEach(() => {
      delete process.env.JWT_PRIVATE_KEY;
      delete process.env.JWT_PUBLIC_KEY;
      process.env.JWT_SECRET = "segredo-de-teste";
    });

    it("assina e confere com JWT_SECRET", () => {
      expect(verificarToken(assinarToken(usuario, "1h"))).toEqual(usuario);
    });
  });

  describe("modo ES256 (chaves assimétricas)", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ec", {
      namedCurve: "P-256",
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });

    beforeEach(() => {
      process.env.JWT_PRIVATE_KEY = paraBase64(privateKey);
      process.env.JWT_PUBLIC_KEY = paraBase64(publicKey);
      process.env.JWT_SECRET = "segredo-de-teste";
    });

    it("a identidade assina com a privada e os serviços conferem só com a pública", () => {
      const token = assinarToken(usuario, "1h");
      expect(jwt.decode(token, { complete: true })?.header.alg).toBe("ES256");

      delete process.env.JWT_PRIVATE_KEY;
      delete process.env.JWT_SECRET;
      expect(verificarToken(token)).toEqual(usuario);
    });

    it("aceita a chave em PEM com \\n literais", () => {
      const token = assinarToken(usuario, "1h");
      process.env.JWT_PUBLIC_KEY = publicKey.replace(/\n/g, "\\n");
      expect(verificarToken(token)).toEqual(usuario);
    });

    it("recusa token HS256, mesmo assinado com o JWT_SECRET antigo", () => {
      expect(verificarToken(jwt.sign(usuario, "segredo-de-teste"))).toBeNull();
    });

    it("recusa token HS256 assinado com a própria chave pública (confusão de algoritmo)", () => {
      expect(verificarToken(jwt.sign(usuario, publicKey, { algorithm: "HS256" }))).toBeNull();
    });

    it("recusa token assinado com outra chave privada", () => {
      const outra = generateKeyPairSync("ec", {
        namedCurve: "P-256",
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
        publicKeyEncoding: { type: "spki", format: "pem" },
      });
      expect(verificarToken(jwt.sign(usuario, outra.privateKey, { algorithm: "ES256" }))).toBeNull();
    });
  });

  it("marcaDeSessao muda quando o hash da senha muda", () => {
    process.env.JWT_SECRET = "segredo-de-teste";
    expect(marcaDeSessao("hash-a")).not.toBe(marcaDeSessao("hash-b"));
    expect(marcaDeSessao("hash-a")).toBe(marcaDeSessao("hash-a"));
  });
});
