import express, { NextFunction, Request, Response } from "express";
import request from "supertest";

const handler = jest.fn((_req: Request, res: Response) => res.status(200).json({ ok: true }));

jest.mock("../../src/controllers/pedidos.controller", () => ({
  __esModule: true,
  default: { findAll: handler, create: handler, checkout: handler, findMine: handler, getById: handler, update: handler, remove: handler },
}));
jest.mock("../../src/controllers/pedidoItens.controller", () => ({
  __esModule: true,
  default: { create: handler, getByIdOrder: handler, update: handler, remove: handler },
}));
// O cargo vem do cabecalho x-test-role; a checagem de permissao e a real.
jest.mock("@agnus/comum/middlewares/auth.middleware", () => ({
  __esModule: true,
  default: (req: Request, res: Response, next: NextFunction) => {
    res.locals.authUser = { id_usuario: 1, email: "a@a.com", tipo: req.header("x-test-role") };
    next();
  },
}));

import pedidosRoutes from "../../src/routes/pedidos.routes";

const app = express().use(express.json()).use(pedidosRoutes);

describe("rotas de pedidos", () => {
  it.each([
    ["post", "/orders"],
    ["post", "/order-items"],
    ["put", "/order-items/1"],
    ["delete", "/order-items/1"],
    ["put", "/orders/1"],
  ] as const)("cliente recebe 403 em %s %s", async (method, path) => {
    const res = await request(app)[method](path).set("x-test-role", "cliente").send({ id_usuario: 1, valor_total: 0, status: "pago" });
    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it("cliente compra pelo checkout e administrador lanca pedido manual", async () => {
    expect((await request(app).post("/orders/checkout").set("x-test-role", "cliente")).status).toBe(200);
    expect((await request(app).post("/orders").set("x-test-role", "administrador")).status).toBe(200);
    expect((await request(app).post("/order-items").set("x-test-role", "administrador")).status).toBe(200);
  });
});
