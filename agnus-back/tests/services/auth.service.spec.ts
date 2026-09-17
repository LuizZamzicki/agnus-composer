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

  it("buildGoogleAuthorizationUrl embute a origem no state", () => {
    jwtMock.sign.mockReturnValueOnce("state-token");
    AuthService.buildGoogleAuthorizationUrl(undefined, "https://192.168.101.13");
    expect(jwtMock.sign).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "google", origin: "https://192.168.101.13" }),
      "state-secret",
      { expiresIn: "10m" },
    );
  });

  it("peekGoogleStateOrigin devolve a origem de um state valido", () => {
    jwtMock.verify.mockReturnValueOnce({ provider: "google", origin: "https://192.168.101.13" } as never);
    expect(AuthService.peekGoogleStateOrigin("state")).toBe("https://192.168.101.13");
  });

  it("peekGoogleStateOrigin devolve undefined para state invalido", () => {
    jwtMock.verify.mockImplementationOnce(() => { throw new Error("bad"); });
    expect(AuthService.peekGoogleStateOrigin("state")).toBeUndefined();
  });

  describe("resolveTrustedOrigin", () => {
    it("devolve undefined quando nao ha origem", () => {
      expect(AuthService.resolveTrustedOrigin(undefined)).toBeUndefined();
    });

    it("devolve undefined para uma URL invalida", () => {
      expect(AuthService.resolveTrustedOrigin("nao-e-uma-url")).toBeUndefined();
    });

    it("rejeita esquemas diferentes de http/https", () => {
      expect(AuthService.resolveTrustedOrigin("ftp://192.168.0.1")).toBeUndefined();
    });

    it("confia em localhost", () => {
      expect(AuthService.resolveTrustedOrigin("http://localhost:3001/login")).toBe("http://localhost:3001");
    });

    it.each([
      "http://127.0.0.1:3000",
      "http://10.0.0.5",
      "https://192.168.101.13",
      "http://172.16.0.4",
      "http://172.31.255.254",
    ])("confia em IP de rede privada: %s", (origin) => {
      expect(AuthService.resolveTrustedOrigin(origin)).toBe(new URL(origin).origin);
    });

    it("nao confia em um IP publico fora da allowlist", () => {
      expect(AuthService.resolveTrustedOrigin("http://8.8.8.8")).toBeUndefined();
    });

    it("nao confia em 172.32.x.x (fora da faixa privada 172.16-31.x.x)", () => {
      expect(AuthService.resolveTrustedOrigin("http://172.32.0.1")).toBeUndefined();
    });

    it("confia em uma origem publica explicitamente configurada via TRUSTED_FRONTEND_ORIGINS", () => {
      process.env.TRUSTED_FRONTEND_ORIGINS = "https://agnus.com.br, https://outro.dominio.com";
      expect(AuthService.resolveTrustedOrigin("https://agnus.com.br")).toBe("https://agnus.com.br");
      delete process.env.TRUSTED_FRONTEND_ORIGINS;
    });

    it("nao confia em uma origem publica fora da allowlist configurada", () => {
      process.env.TRUSTED_FRONTEND_ORIGINS = "https://agnus.com.br";
      expect(AuthService.resolveTrustedOrigin("https://evil.example")).toBeUndefined();
      delete process.env.TRUSTED_FRONTEND_ORIGINS;
    });
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
});
