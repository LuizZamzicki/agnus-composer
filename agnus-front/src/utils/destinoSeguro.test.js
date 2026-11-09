import { destinoSeguro } from "./destinoSeguro";

describe("destinoSeguro", () => {
  it.each(["/", "/finalizar", "/produto/1?cor=2#fotos"])("aceita o caminho interno %s", (valor) => {
    expect(destinoSeguro(valor)).toBe(valor);
  });

  it.each([null, "", "finalizar", "https://evil.invalid", "//evil.invalid", "/\\evil.invalid", "/\t/evil.invalid"])(
    "recusa %s",
    (valor) => {
      expect(destinoSeguro(valor)).toBeNull();
    },
  );
});
