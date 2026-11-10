import express, { Request, Response } from "express";
import request from "supertest";

const handler = jest.fn((_req: Request, res: Response) => res.status(401).json({ ok: false }));

jest.mock("../../src/controllers/auth.controller", () => ({
  __esModule: true,
  default: { login: handler, me: handler, googleStart: handler, googleCallback: handler },
}));
jest.mock("../../src/controllers/usuarios.controller", () => ({
  __esModule: true,
  default: { create: handler, findAll: handler, getById: handler, remove: handler, update: handler, updatePassword: handler },
}));
jest.mock("@agnus/comum/middlewares/auth.middleware", () => ({
  __esModule: true,
  default: jest.fn(),
  authorizeSelfOrAdmin: () => jest.fn(),
}));

import identidadeRoutes from "../../src/routes/identidade.routes";

const app = express().use(express.json()).use(identidadeRoutes);

const enviar = async (path: string, vezes: number) => {
  const respostas = [];

  for (let i = 0; i < vezes; i += 1) {
    respostas.push((await request(app).post(path).send({})).status);
  }

  return respostas;
};

describe("limite de tentativas", () => {
  it("responde 429 depois de 10 logins, em qualquer grafia da rota", async () => {
    const respostas = await enviar("/auth/login", 6);
    respostas.push(...(await enviar("/auth/login/", 2)), ...(await enviar("/AUTH/login", 2)));
    expect(respostas).toEqual(Array(10).fill(401));
    expect(await enviar("/AUTH/LOGIN/", 1)).toEqual([429]);
  });

  it("responde 429 depois de 5 cadastros", async () => {
    expect(await enviar("/users", 5)).toEqual(Array(5).fill(401));
    expect(await enviar("/users", 1)).toEqual([429]);
  });
});
