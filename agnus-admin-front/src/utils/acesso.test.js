import { destinoDoAcesso } from "./acesso";

describe("destinoDoAcesso", () => {
  beforeEach(() => localStorage.clear());

  it("manda quem não está logado para o login", () => {
    expect(destinoDoAcesso()).toBe("/login");
  });

  it("manda cliente de volta para a loja", () => {
    localStorage.setItem("auth", JSON.stringify({ tipo: "cliente" }));
    expect(destinoDoAcesso()).toBe("/home");
  });

  it("libera o administrador", () => {
    localStorage.setItem("auth", JSON.stringify({ tipo: "administrador" }));
    expect(destinoDoAcesso()).toBeNull();
  });

  it("trata sessão corrompida como não logado", () => {
    localStorage.setItem("auth", "{");
    expect(destinoDoAcesso()).toBe("/login");
  });
});
