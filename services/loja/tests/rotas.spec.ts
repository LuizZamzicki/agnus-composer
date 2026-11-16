import request from "supertest";
import app from "../src/app";

describe("rotas da loja", () => {
  it.each([
    ["post", "/loja/sacolas"],
    ["post", "/loja/sacolas/qualquer/linhas"],
    ["patch", "/loja/sacolas/qualquer/linhas/l1"],
    ["delete", "/loja/sacolas/qualquer/linhas/l1"],
    ["get", "/loja/pedidos"],
  ] as const)("não deixa mexer na sacola sem login (%s %s)", async (metodo, caminho) => {
    expect((await request(app)[metodo](caminho)).status).toBe(401);
  });

  it("não deixa finalizar a compra sem login", async () => {
    const resposta = await request(app).post("/loja/sacolas/qualquer/checkout");

    expect(resposta.status).toBe(401);
    expect(resposta.body).not.toHaveProperty("checkoutUrl");
  });
});
