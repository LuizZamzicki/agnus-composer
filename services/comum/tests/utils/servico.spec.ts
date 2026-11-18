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

describe("criarApp: limite do corpo", () => {
  const eco = Router()
    .post("/fotos", (req, res) => void res.json({ tamanho: JSON.stringify(req.body).length }))
    .post("/dados", (req, res) => void res.json({ tamanho: JSON.stringify(req.body).length }));
  const app = criarApp({ rotas: eco, rotasComCorpoGrande: ["/fotos"] });
  const grande = { texto: "x".repeat(2 * 1024 * 1024) };

  it("recusa corpo grande fora das rotas de foto com 413", async () => {
    const resposta = await request(app).post("/dados").send(grande);
    expect(resposta.status).toBe(413);
  });

  it("aceita corpo grande nas rotas de foto", async () => {
    expect((await request(app).post("/fotos").send(grande)).status).toBe(200);
  });

  it("recusa corpo comprimido com 415", async () => {
    const resposta = await request(app)
      .post("/dados")
      .set("Content-Type", "application/json")
      .set("Content-Encoding", "gzip")
      .send(require("zlib").gzipSync(JSON.stringify({ a: 1 })));
    expect(resposta.status).toBe(415);
  });
});
