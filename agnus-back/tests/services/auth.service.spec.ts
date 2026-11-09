import argon2 from "argon2";
import jwt from "jsonwebtoken";
import Usuarios from "../../src/models/Usuarios";
import AuthService from "../../src/services/auth.service";
import type { AuthUserPayload } from "../../src/types/auth.types";
import type { UsuarioPublicData, UserRole } from "../../src/types/user.types";
import { buildModelInstance } from "../helpers/http";

jest.mock("argon2", () => ({
  __esModule: true,
  default: {
    argon2id: 2,
    hash: jest.fn(),
    verify: jest.fn(),
  },
}));
jest.mock("jsonwebtoken", () => ({
  __esModule: true,
  default: {
    sign: jest.fn(),
    verify: jest.fn(),
  },
}));
jest.mock("crypto", () => ({
  __esModule: true,
  default: {
    randomBytes: jest.fn(() => Buffer.from("1234567890123456")),
  },
}));
jest.mock("../../src/models/Usuarios", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
}));

type Argon2Mock = { argon2id: number; hash: jest.Mock; verify: jest.Mock };
type JwtMock = { sign: jest.Mock; verify: jest.Mock };
type UsuariosModelMock = { findOne: jest.Mock; create: jest.Mock };

const argon2Mock = argon2 as typeof argon2 & Argon2Mock;
const jwtMock = jwt as typeof jwt & JwtMock;
const usuariosModel = Usuarios as typeof Usuarios & UsuariosModelMock;
const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;
const buildPublicUser = (email: string, tipo: UserRole = "cliente", google_id: string | null = null): UsuarioPublicData => ({
  id_usuario: 1,
  nome: "Ana",
  cpf: null,
  email,
  google_id,
  tipo,
  data_criacao: new Date("2026-01-01T00:00:00.000Z"),
  data_alteracao: new Date("2026-01-01T00:00:00.000Z"),
});

describe("AuthService", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "secret";
    process.env.JWT_EXPIRES_IN = "1h";
    process.env.GOOGLE_CLIENT_ID = "client";
    process.env.GOOGLE_CLIENT_SECRET = "secret-google";
    process.env.GOOGLE_REDIRECT_URI = "http://localhost/callback";
    delete process.env.GOOGLE_REDIRECT_URI_WEB;
    process.env.GOOGLE_OAUTH_SCOPES = "openid email profile";
    process.env.GOOGLE_STATE_SECRET = "state-secret";
    global.fetch = fetchMock;
    jest.clearAllMocks();
  });

  it("sanitizeUser remove a senha", () => {
    const user = buildModelInstance({ ...buildPublicUser("a@a.com"), senha: "hash" });
    expect(AuthService.sanitizeUser(user as never as Usuarios)).toEqual(buildPublicUser("a@a.com"));
  });

  it("signToken assina o payload configurado", () => {
    const payload: AuthUserPayload = { id_usuario: 1, email: "a@a.com", tipo: "cliente" };
    jwtMock.sign.mockReturnValueOnce("jwt-token");
    expect(AuthService.signToken(payload)).toBe("jwt-token");
    expect(jwtMock.sign).toHaveBeenCalledWith(payload, "secret", { expiresIn: "1h" });
  });

  it("verifyToken devolve payload valido", () => {
    jwtMock.verify.mockReturnValueOnce({ id_usuario: 1, email: "a@a.com", tipo: "administrador" } as never);
    expect(AuthService.verifyToken("jwt-token")).toEqual({ id_usuario: 1, email: "a@a.com", tipo: "administrador" });
  });

  it("verifyToken devolve null para payload incompleto", () => {
    jwtMock.verify.mockReturnValueOnce({ id_usuario: 1 } as never);
    expect(AuthService.verifyToken("bad")).toBeNull();
  });

  it("verifyToken devolve null para token invalido", () => {
    jwtMock.verify.mockImplementationOnce(() => { throw new Error("invalid"); });
    expect(AuthService.verifyToken("bad")).toBeNull();
  });

  it("authenticate devolve null quando o usuario nao existe", async () => {
    usuariosModel.findOne.mockResolvedValueOnce(null);
    await expect(AuthService.authenticate("a@a.com", "123")).resolves.toBeNull();
  });

  it("authenticate devolve null para senha invalida", async () => {
    const user = buildModelInstance({ ...buildPublicUser("a@a.com"), senha: "hash" });
    usuariosModel.findOne.mockResolvedValueOnce(user as never as Usuarios);
    argon2Mock.verify.mockResolvedValueOnce(false as never);
    await expect(AuthService.authenticate("a@a.com", "123")).resolves.toBeNull();
  });

  it("authenticate devolve usuario e token no sucesso", async () => {
    const user = buildModelInstance({ ...buildPublicUser("a@a.com"), senha: "hash" });
    usuariosModel.findOne.mockResolvedValueOnce(user as never as Usuarios);
    argon2Mock.verify.mockResolvedValueOnce(true as never);
    jwtMock.sign.mockReturnValueOnce("jwt-ok");
    await expect(AuthService.authenticate("a@a.com", "123")).resolves.toEqual({ user: buildPublicUser("a@a.com"), token: "jwt-ok" });
    expect(usuariosModel.findOne).toHaveBeenCalledWith({ where: { email: "a@a.com" } });
    expect(argon2Mock.verify).toHaveBeenCalledWith("hash", "123");
  });

  it("buildGoogleAuthorizationUrl monta a URL", () => {
    jwtMock.sign.mockReturnValueOnce("state-token");
    const url = AuthService.buildGoogleAuthorizationUrl();
    expect(url).toContain("accounts.google.com/o/oauth2/v2/auth");
    expect(url).toContain("client_id=client");
    expect(url).toContain("redirect_uri=http%3A%2F%2Flocalhost%2Fcallback");
    expect(url).toContain("state=state-token");
  });

  it("usa o callback web no site e o callback publico (ngrok) no app", () => {
    process.env.GOOGLE_REDIRECT_URI = "https://agnus.ngrok-free.dev/auth/google/callback";
    process.env.GOOGLE_REDIRECT_URI_WEB = "https://localhost/api/auth/google/callback";
    jwtMock.sign.mockReturnValue("state-token");

    expect(AuthService.buildGoogleAuthorizationUrl()).toContain(
      `redirect_uri=${encodeURIComponent("https://localhost/api/auth/google/callback")}`,
    );
    expect(AuthService.buildGoogleAuthorizationUrl("agnusapp://login")).toContain(
      `redirect_uri=${encodeURIComponent("https://agnus.ngrok-free.dev/auth/google/callback")}`,
    );
    jwtMock.sign.mockReset();
  });

  it.each([
    ["site", undefined, "https://localhost/api/auth/google/callback"],
    ["app", "agnusapp://login", "https://agnus.ngrok-free.dev/auth/google/callback"],
  ])("na troca do codigo (%s) repete o redirect_uri usado na autorizacao", async (_label, appRedirect, expected) => {
    process.env.GOOGLE_REDIRECT_URI = "https://agnus.ngrok-free.dev/auth/google/callback";
    process.env.GOOGLE_REDIRECT_URI_WEB = "https://localhost/api/auth/google/callback";
    jwtMock.verify
      .mockReturnValueOnce({ provider: "google" } as never)
      .mockReturnValueOnce({ provider: "google", ...(appRedirect ? { redirect: appRedirect } : {}) } as never);
    fetchMock.mockResolvedValueOnce(new Response("bad code", { status: 400 }));

    await expect(AuthService.authenticateWithGoogle("code", "state")).rejects.toThrow("Falha ao obter token Google");

    const body = fetchMock.mock.calls[0][1]?.body as URLSearchParams;
    expect(body.get("redirect_uri")).toBe(expected);
  });

  it("buildGoogleAuthorizationUrl falha sem configuracao", () => {
    process.env.GOOGLE_CLIENT_ID = "";
    process.env.GOOGLE_CLIENT_SECRET = "";
    expect(() => AuthService.buildGoogleAuthorizationUrl()).toThrow("Google OAuth");
  });

  it("buildGoogleAuthorizationUrl embute o redirect do app no state", () => {
    jwtMock.sign.mockReturnValueOnce("state-token");
    AuthService.buildGoogleAuthorizationUrl("exp://host/--/auth");
    expect(jwtMock.sign).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "google", redirect: "exp://host/--/auth" }),
      "state-secret",
      { expiresIn: "10m" },
    );
  });

  it("peekGoogleStateRedirect devolve o redirect de um state valido", () => {
    jwtMock.verify.mockReturnValueOnce({ provider: "google", redirect: "agnusapp://auth" } as never);
    expect(AuthService.peekGoogleStateRedirect("state")).toBe("agnusapp://auth");
  });

  it("peekGoogleStateRedirect devolve undefined para state invalido", () => {
    jwtMock.verify.mockImplementationOnce(() => { throw new Error("bad"); });
    expect(AuthService.peekGoogleStateRedirect("state")).toBeUndefined();
  });

  it("authenticateWithGoogle falha com estado invalido", async () => {
    jwtMock.verify.mockImplementationOnce(() => { throw new Error("state invalid"); });
    await expect(AuthService.authenticateWithGoogle("code", "state")).rejects.toThrow("Estado OAuth");
  });

  it("authenticateWithGoogle falha ao obter token do Google", async () => {
    jwtMock.verify.mockReturnValueOnce({ provider: "google" } as never);
    fetchMock.mockResolvedValueOnce(new Response("bad code", { status: 400 }));
    await expect(AuthService.authenticateWithGoogle("code", "state")).rejects.toThrow("Falha ao obter token Google");
  });

  it("authenticateWithGoogle falha quando o perfil nao tem email verificado", async () => {
    jwtMock.verify.mockReturnValueOnce({ provider: "google" } as never);
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "ga" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ email: "", email_verified: false }), { status: 200 }));
    await expect(AuthService.authenticateWithGoogle("code", "state")).rejects.toThrow("Conta Google sem email verificado.");
  });

  it("authenticateWithGoogle autentica usuario existente por google_id", async () => {
    const user = buildModelInstance({ ...buildPublicUser("a@a.com"), google_id: "sub-1", senha: "hash" });
    jwtMock.verify.mockReturnValueOnce({ provider: "google" } as never);
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "ga" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ sub: "sub-1", name: "A", email: "a@a.com", email_verified: true }), { status: 200 }));
    usuariosModel.findOne.mockResolvedValueOnce(user as never as Usuarios);
    jwtMock.sign.mockReturnValueOnce("jwt-user");
    await expect(AuthService.authenticateWithGoogle("code", "state")).resolves.toEqual({ user: buildPublicUser("a@a.com", "cliente", "sub-1"), token: "jwt-user" });
  });

  it("authenticateWithGoogle vincula conta existente por email", async () => {
    const user = buildModelInstance({ ...buildPublicUser("b@b.com"), id_usuario: 2, google_id: null, senha: "hash" });
    jwtMock.verify.mockReturnValueOnce({ provider: "google" } as never);
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "ga" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ sub: "sub-2", name: "B", email: "b@b.com", email_verified: true }), { status: 200 }));
    usuariosModel.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(user as never as Usuarios);
    jwtMock.sign.mockReturnValueOnce("jwt-email");
    await expect(AuthService.authenticateWithGoogle("code", "state")).resolves.toEqual({ user: { ...buildPublicUser("b@b.com", "cliente", "sub-2"), id_usuario: 2 }, token: "jwt-email" });
    expect(user.update).toHaveBeenCalledWith({ google_id: "sub-2" });
  });

  it("authenticateWithGoogle cria usuario quando nao encontra conta", async () => {
    const user = buildModelInstance({ ...buildPublicUser("c@c.com"), id_usuario: 3, google_id: "sub-3", senha: "hash" });
    jwtMock.verify.mockReturnValueOnce({ provider: "google" } as never);
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "ga" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ sub: "sub-3", name: "C", email: "c@c.com", email_verified: true }), { status: 200 }));
    usuariosModel.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    argon2Mock.hash.mockResolvedValueOnce("hashed-random" as never);
    usuariosModel.create.mockResolvedValueOnce(user as never as Usuarios);
    jwtMock.sign.mockReturnValueOnce("jwt-create");
    await expect(AuthService.authenticateWithGoogle("code", "state")).resolves.toEqual({ user: { ...buildPublicUser("c@c.com"), id_usuario: 3, google_id: "sub-3" }, token: "jwt-create" });
    expect(usuariosModel.create).toHaveBeenCalledWith({ nome: "C", email: "c@c.com", senha: "hashed-random", tipo: "cliente", google_id: "sub-3" });
  });

  it("authenticateWithGoogle falha ao buscar perfil do Google", async () => {
    jwtMock.verify.mockReturnValueOnce({ provider: "google" } as never);
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "ga" }), { status: 200 }))
      .mockResolvedValueOnce(new Response("profile error", { status: 500 }));
    await expect(AuthService.authenticateWithGoogle("code", "state")).rejects.toThrow("Falha ao obter perfil Google");
  });

  it("authenticateWithGoogle descarta a senha ao vincular conta local pelo e-mail", async () => {
    const user = buildModelInstance({ ...buildPublicUser("a@a.com"), google_id: null, senha: "hash-do-atacante" });
    jwtMock.verify.mockReturnValueOnce({ provider: "google" } as never);
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "ga" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ sub: "sub-1", name: "A", email: "a@a.com", email_verified: true }), { status: 200 }));
    usuariosModel.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(user as never as Usuarios);
    argon2Mock.hash.mockResolvedValueOnce("hash-aleatorio");
    jwtMock.sign.mockReturnValueOnce("jwt-user");
    await AuthService.authenticateWithGoogle("code", "state");
    expect(user.update).toHaveBeenCalledWith({ google_id: "sub-1", senha: "hash-aleatorio" });
  });

  it("authenticateWithGoogle devolve o nonce do navegador guardado no state", async () => {
    const user = buildModelInstance({ ...buildPublicUser("a@a.com"), google_id: "sub-1", senha: "hash" });
    const state = { provider: "google", clientNonce: "nonce-do-navegador" };
    jwtMock.verify.mockReturnValue(state as never);
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "ga" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ sub: "sub-1", name: "A", email: "a@a.com", email_verified: true }), { status: 200 }));
    usuariosModel.findOne.mockResolvedValueOnce(user as never as Usuarios);
    jwtMock.sign.mockReturnValueOnce("jwt-user");
    await expect(AuthService.authenticateWithGoogle("code", "state")).resolves.toMatchObject({ clientNonce: "nonce-do-navegador" });
    jwtMock.verify.mockReset();
  });
});
