import request from "supertest";
import { Router } from "express";
import { criarApp } from "../../src/utils/servico";

const interno = Router().get("/ping", (_req, res) => void res.json({ ok: true }));
const rotas = Router().get("/publica", (_req, res) => void res.json({ ok: true }));

describe("criarApp", () => {
  const app = criarApp({ rotas, interno });

  beforeEach(() => {
    process.env.INTERNAL_API_TOKEN = "segredo";
  });

  it("expõe /health e as rotas públicas", async () => {
    expect((await request(app).get("/health")).status).toBe(200);
    expect((await request(app).get("/publica")).status).toBe(200);
  });

  it("recusa /internal sem o token", async () => {
    expect((await request(app).get("/internal/ping")).status).toBe(403);
    expect((await request(app).get("/internal/ping").set("x-internal-token", "errado")).status).toBe(403);
  });

  it("recusa /internal quando o token não foi configurado", async () => {
    process.env.INTERNAL_API_TOKEN = "";
    expect((await request(app).get("/internal/ping").set("x-internal-token", "")).status).toBe(403);
  });

  it("aceita /internal com o token", async () => {
    expect((await request(app).get("/internal/ping").set("x-internal-token", "segredo")).status).toBe(200);
  });
});
