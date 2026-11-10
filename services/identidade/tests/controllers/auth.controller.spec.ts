import AuthController from "../../src/controllers/auth.controller";
import UsuarioSenhasHistoricoController from "../../src/controllers/usuarioSenhasHistorico.controller";
import Usuarios from "../../src/models/Usuarios";
import AuthService from "../../src/services/auth.service";
import type { UsuarioPublicData } from "@agnus/comum/types/user.types";
import { buildModelInstance, mockRequest, mockResponse } from "../helpers/http";

jest.mock("../../src/services/auth.service", () => ({
  __esModule: true,
  default: {
    authenticate: jest.fn(),
    sanitizeUser: jest.fn(),
    buildGoogleAuthorizationUrl: jest.fn(),
    authenticateWithGoogle: jest.fn(),
    peekGoogleStateRedirect: jest.fn(),
  },
}));
jest.mock("../../src/models/Usuarios", () => ({
  __esModule: true,
  default: { findByPk: jest.fn() },
}));

type AuthServiceMock = {
  authenticate: jest.Mock;
  sanitizeUser: jest.Mock;
  buildGoogleAuthorizationUrl: jest.Mock;
  authenticateWithGoogle: jest.Mock;
  peekGoogleStateRedirect: jest.Mock;
};
type UsuariosModelMock = { findByPk: jest.Mock };

const authService = AuthService as typeof AuthService & AuthServiceMock;
const usuariosModel = Usuarios as typeof Usuarios & UsuariosModelMock;
const buildPublicUser = (): UsuarioPublicData => ({
  id_usuario: 1,
  nome: "Ana",
  cpf: null,
  email: "a@a.com",
  google_id: null,
  tipo: "cliente",
  data_criacao: new Date("2026-01-01T00:00:00.000Z"),
  data_alteracao: new Date("2026-01-01T00:00:00.000Z"),
});

describe("AuthController", () => {
  const originalFrontendUrl = process.env.FRONTEND_URL;

  beforeEach(() => {
    process.env.FRONTEND_URL = "http://localhost:3001";
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env.FRONTEND_URL = originalFrontendUrl;
  });

  it("login retorna 400 sem email ou senha", async () => {
    const response = mockResponse();
    await AuthController.login(mockRequest({ body: {} }), response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "Email e senha são obrigatórios." });
  });

  it("login retorna 400 para email inválido", async () => {
    const response = mockResponse();
    await AuthController.login(mockRequest({ body: { email: "aaa", senha: "123" } }), response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "email inválido." });
  });

  it("login não revela que a senha informada já foi usada", async () => {
    const response = mockResponse();
    const historySpy = jest.spyOn(UsuarioSenhasHistoricoController, "findByPasswordHash");

    authService.authenticate.mockResolvedValueOnce(null);

    await AuthController.login(mockRequest({ body: { email: "a@a.com", senha: "SenhaAntiga@1" } }), response);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({ message: "Credenciais inválidas." });
    expect(historySpy).not.toHaveBeenCalled();
  });

  it("login retorna 401 com credenciais inválidas", async () => {
    const response = mockResponse();
    authService.authenticate.mockResolvedValueOnce(null);
    await AuthController.login(mockRequest({ body: { email: "a@a.com", senha: "123" } }), response);
    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({ message: "Credenciais inválidas." });
  });

  it("login retorna 200 com token e usuário", async () => {
    const response = mockResponse();
    const user = buildPublicUser();

    authService.authenticate.mockResolvedValueOnce({ token: "jwt", user });

    await AuthController.login(mockRequest({ body: { email: "a@a.com", senha: "123" } }), response);

    expect(authService.authenticate).toHaveBeenCalledWith("a@a.com", "123");
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({ token: "jwt", user });
  });

  it("me retorna 401 sem autenticação", async () => {
    const response = mockResponse();
    await AuthController.me(mockRequest(), response);
    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({ message: "Não autenticado." });
  });

  it("me retorna 404 quando o usuário não existe", async () => {
    const response = mockResponse();
    response.locals.authUser = { id_usuario: 1, email: "a@a.com", tipo: "cliente" };
    usuariosModel.findByPk.mockResolvedValueOnce(null);
    await AuthController.me(mockRequest(), response);
    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ message: "Usuário não encontrado." });
  });

  it("me retorna 200 com o usuário sanitizado", async () => {
    const response = mockResponse();
    const user = buildModelInstance({ ...buildPublicUser(), senha: "hash" });
    const publicUser = buildPublicUser();

    response.locals.authUser = { id_usuario: 1, email: "a@a.com", tipo: "cliente" };
    usuariosModel.findByPk.mockResolvedValueOnce(user);
    authService.sanitizeUser.mockReturnValueOnce(publicUser);

    await AuthController.me(mockRequest(), response);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({ user: publicUser });
  });

  it("googleStart redireciona com a URL do provider", async () => {
    const response = mockResponse();
    authService.buildGoogleAuthorizationUrl.mockReturnValueOnce("https://google/auth");
    await AuthController.googleStart(mockRequest(), response);
    expect(response.redirect).toHaveBeenCalledWith("https://google/auth");
  });

  it("googleStart repassa um redirect de app permitido", async () => {
    const response = mockResponse();
    authService.buildGoogleAuthorizationUrl.mockReturnValueOnce("https://google/auth");
    await AuthController.googleStart(
      mockRequest({ query: { redirect: "exp://192.168.0.5:8081/--/auth" } }),
      response,
    );
    expect(authService.buildGoogleAuthorizationUrl).toHaveBeenCalledWith(
      "exp://192.168.0.5:8081/--/auth",
      undefined,
    );
  });

  it("googleStart ignora um redirect de app fora do allowlist", async () => {
    const response = mockResponse();
    authService.buildGoogleAuthorizationUrl.mockReturnValueOnce("https://google/auth");
    await AuthController.googleStart(
      mockRequest({ query: { redirect: "https://evil.example/steal" } }),
      response,
    );
    expect(authService.buildGoogleAuthorizationUrl).toHaveBeenCalledWith(undefined, undefined);
  });

  it("googleStart retorna 500 quando falha", async () => {
    const response = mockResponse();

    authService.buildGoogleAuthorizationUrl.mockImplementationOnce(() => {
      throw new Error("no cfg");
    });

    await AuthController.googleStart(mockRequest(), response);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({ message: "no cfg" });
  });

  it("googleCallback redireciona quando o provider retorna erro", async () => {
    const response = mockResponse();

    await AuthController.googleCallback(mockRequest({ query: { error: "access_denied" } }), response);

    expect(response.redirect).toHaveBeenCalledWith(
      "http://localhost:3001/login?error=Google%20OAuth%20retornou%20erro%3A%20access_denied",
    );
  });

  it("googleCallback redireciona quando os parametros são inválidos", async () => {
    const response = mockResponse();

    await AuthController.googleCallback(mockRequest({ query: { code: 1, state: "a" } }), response);

    expect(response.redirect).toHaveBeenCalledWith(
      "http://localhost:3001/login?error=Par%C3%A2metros%20OAuth%20inv%C3%A1lidos.",
    );
  });

  it("googleCallback redireciona com token no sucesso", async () => {
    const response = mockResponse();

    authService.authenticateWithGoogle.mockResolvedValueOnce({ token: "jwt", user: buildPublicUser() });

    await AuthController.googleCallback(mockRequest({ query: { code: "c", state: "s" } }), response);

    expect(authService.authenticateWithGoogle).toHaveBeenCalledWith("c", "s");
    expect(response.redirect).toHaveBeenCalledWith(
      "http://localhost:3001/login?token=jwt&tipo=cliente&success=1",
    );
  });

  it("googleCallback redireciona com erro do service", async () => {
    const response = mockResponse();

    authService.authenticateWithGoogle.mockRejectedValueOnce(new Error("invalid"));

    await AuthController.googleCallback(mockRequest({ query: { code: "c", state: "s" } }), response);

    expect(response.redirect).toHaveBeenCalledWith("http://localhost:3001/login?error=invalid");
  });

  it("googleCallback redireciona com erro inesperado serializado", async () => {
    const response = mockResponse();

    authService.authenticateWithGoogle.mockRejectedValueOnce("invalid");

    await AuthController.googleCallback(mockRequest({ query: { code: "c", state: "s" } }), response);

    expect(response.redirect).toHaveBeenCalledWith("http://localhost:3001/login?error=invalid");
  });

  it("googleCallback manda o token pro app quando o state tem redirect", async () => {
    const response = mockResponse();

    authService.authenticateWithGoogle.mockResolvedValueOnce({
      token: "jwt",
      user: buildPublicUser(),
      redirect: "exp://192.168.0.5:8081/--/auth",
    });

    await AuthController.googleCallback(mockRequest({ query: { code: "c", state: "s" } }), response);

    expect(response.redirect).toHaveBeenCalledWith(
      "exp://192.168.0.5:8081/--/auth?token=jwt&tipo=cliente&success=1",
    );
  });

  it("googleCallback manda o erro pro app quando o state tem redirect", async () => {
    const response = mockResponse();

    authService.authenticateWithGoogle.mockRejectedValueOnce(new Error("invalid"));
    authService.peekGoogleStateRedirect.mockReturnValueOnce("agnusapp://auth");

    await AuthController.googleCallback(mockRequest({ query: { code: "c", state: "s" } }), response);

    expect(response.redirect).toHaveBeenCalledWith("agnusapp://auth?error=invalid");
  });

  it.each([
    "http://localhost.attacker.example/cb",
    "http://127.0.0.1.attacker.example/cb",
    "http://localhost@attacker.example/cb",
    "http://localhost:80@attacker.example/cb",
    "https://attacker.example/cb",
    "não e url",
  ])("googleStart recusa o redirect %s", async (redirect) => {
    authService.buildGoogleAuthorizationUrl.mockReturnValueOnce("https://google/auth");
    await AuthController.googleStart(mockRequest({ query: { redirect } }), mockResponse());
    expect(authService.buildGoogleAuthorizationUrl).toHaveBeenCalledWith(undefined, undefined);
  });

  it.each(["http://localhost:19006/cb", "http://127.0.0.1:8081/cb", "agnusapp://login", "exp+agnus://cb"])(
    "googleStart aceita em desenvolvimento o retorno %s",
    async (redirect) => {
      authService.buildGoogleAuthorizationUrl.mockReturnValueOnce("https://google/auth");
      await AuthController.googleStart(mockRequest({ query: { redirect } }), mockResponse());
      expect(authService.buildGoogleAuthorizationUrl).toHaveBeenCalledWith(redirect, undefined);
    },
  );

  describe("em produção", () => {
    const nodeEnv = process.env.NODE_ENV;

    beforeEach(() => {
      process.env.NODE_ENV = "production";
    });

    afterEach(() => {
      process.env.NODE_ENV = nodeEnv;
    });

    it.each(["exp://attacker.example:8081/--/cb", "exp+evil://cb", "http://localhost:4444/cb"])(
      "googleStart recusa o retorno de desenvolvimento %s",
      async (redirect) => {
        authService.buildGoogleAuthorizationUrl.mockReturnValueOnce("https://google/auth");
        await AuthController.googleStart(mockRequest({ query: { redirect } }), mockResponse());
        expect(authService.buildGoogleAuthorizationUrl).toHaveBeenCalledWith(undefined, undefined);
      },
    );

    it("googleStart mantem o esquema do app", async () => {
      authService.buildGoogleAuthorizationUrl.mockReturnValueOnce("https://google/auth");
      await AuthController.googleStart(mockRequest({ query: { redirect: "agnusapp://login" } }), mockResponse());
      expect(authService.buildGoogleAuthorizationUrl).toHaveBeenCalledWith("agnusapp://login", undefined);
    });
  });

  it("googleStart repassa o nonce do navegador e descarta um nonce malformado", async () => {
    const nonce = "123e4567-e89b-12d3-a456-426614174000";
    authService.buildGoogleAuthorizationUrl.mockReturnValue("https://google/auth");
    await AuthController.googleStart(mockRequest({ query: { nonce } }), mockResponse());
    expect(authService.buildGoogleAuthorizationUrl).toHaveBeenLastCalledWith(undefined, nonce);
    await AuthController.googleStart(mockRequest({ query: { nonce: "<x>" } }), mockResponse());
    expect(authService.buildGoogleAuthorizationUrl).toHaveBeenLastCalledWith(undefined, undefined);
    authService.buildGoogleAuthorizationUrl.mockReset();
  });

  it("login recusa email que não e texto", async () => {
    const response = mockResponse();
    await AuthController.login(mockRequest({ body: { email: ["a@a.com", "b@b.com"], senha: "x" } }), response);
    expect(response.status).toHaveBeenCalledWith(400);
  });
});
