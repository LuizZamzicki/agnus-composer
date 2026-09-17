import AuthController from "../../src/controllers/auth.controller";
import UsuarioSenhasHistoricoController from "../../src/controllers/usuarioSenhasHistorico.controller";
import Usuarios from "../../src/models/Usuarios";
import AuthService from "../../src/services/auth.service";
import type { UsuarioPublicData } from "../../src/types/user.types";
import { buildModelInstance, mockRequest, mockResponse } from "../helpers/http";

jest.mock("../../src/services/auth.service", () => ({
  __esModule: true,
  default: {
    authenticate: jest.fn(),
    sanitizeUser: jest.fn(),
    buildGoogleAuthorizationUrl: jest.fn(),
    authenticateWithGoogle: jest.fn(),
    peekGoogleStateRedirect: jest.fn(),
    peekGoogleStateOrigin: jest.fn(),
    resolveTrustedOrigin: jest.fn(),
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
  peekGoogleStateOrigin: jest.Mock;
  resolveTrustedOrigin: jest.Mock;
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
    expect(response.json).toHaveBeenCalledWith({ message: "Email e senha sao obrigatorios." });
  });

  it("login retorna 400 para email invalido", async () => {
    const response = mockResponse();
    await AuthController.login(mockRequest({ body: { email: "aaa", senha: "123" } }), response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "email invalido." });
  });

  it("login informa reutilizacao de senha", async () => {
    const reusedAt = new Date("2026-01-01T12:00:00.000Z");
    const response = mockResponse();
    const nowSpy = jest
      .spyOn(Date, "now")
      .mockReturnValue(reusedAt.getTime() + 5 * 60000);

    authService.authenticate.mockResolvedValueOnce(null);
    jest.spyOn(UsuarioSenhasHistoricoController, "findByPasswordHash").mockResolvedValueOnce(reusedAt);

    await AuthController.login(mockRequest({ body: { email: "a@a.com", senha: "123" } }), response);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({
      message: `Essa senha ja foi usada ha 5 minutos (em ${new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Sao_Paulo",
      }).format(reusedAt)}).`,
    });

    nowSpy.mockRestore();
  });

  it("login retorna 401 com credenciais invalidas", async () => {
    const response = mockResponse();
    authService.authenticate.mockResolvedValueOnce(null);
    jest.spyOn(UsuarioSenhasHistoricoController, "findByPasswordHash").mockResolvedValueOnce(null);
    await AuthController.login(mockRequest({ body: { email: "a@a.com", senha: "123" } }), response);
    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({ message: "Credenciais invalidas." });
  });

  it("login retorna 200 com token e usuario", async () => {
    const response = mockResponse();
    const user = buildPublicUser();

    authService.authenticate.mockResolvedValueOnce({ token: "jwt", user });

    await AuthController.login(mockRequest({ body: { email: "a@a.com", senha: "123" } }), response);

    expect(authService.authenticate).toHaveBeenCalledWith("a@a.com", "123");
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({ token: "jwt", user });
  });

  it("me retorna 401 sem autenticacao", async () => {
    const response = mockResponse();
    await AuthController.me(mockRequest(), response);
    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({ message: "Nao autenticado." });
  });

  it("me retorna 404 quando o usuario nao existe", async () => {
    const response = mockResponse();
    response.locals.authUser = { id_usuario: 1, email: "a@a.com", tipo: "cliente" };
    usuariosModel.findByPk.mockResolvedValueOnce(null);
    await AuthController.me(mockRequest(), response);
    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ message: "Usuario nao encontrado." });
  });

  it("me retorna 200 com o usuario sanitizado", async () => {
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

  it("googleStart repassa a origem do Referer, ja validada", async () => {
    const response = mockResponse();
    authService.buildGoogleAuthorizationUrl.mockReturnValueOnce("https://google/auth");
    authService.resolveTrustedOrigin.mockReturnValueOnce("https://192.168.101.13");

    await AuthController.googleStart(
      mockRequest({ headers: { referer: "https://192.168.101.13/login" } }),
      response,
    );

    expect(authService.resolveTrustedOrigin).toHaveBeenCalledWith("https://192.168.101.13");
    expect(authService.buildGoogleAuthorizationUrl).toHaveBeenCalledWith(undefined, "https://192.168.101.13");
  });

  it("googleStart usa o Origin quando nao ha Referer", async () => {
    const response = mockResponse();
    authService.buildGoogleAuthorizationUrl.mockReturnValueOnce("https://google/auth");

    await AuthController.googleStart(
      mockRequest({ headers: { origin: "https://192.168.101.13" } }),
      response,
    );

    expect(authService.resolveTrustedOrigin).toHaveBeenCalledWith("https://192.168.101.13");
  });

  it("googleStart nao repassa origem quando o Referer nao e uma URL valida", async () => {
    const response = mockResponse();
    authService.buildGoogleAuthorizationUrl.mockReturnValueOnce("https://google/auth");

    await AuthController.googleStart(
      mockRequest({ headers: { referer: "nao-e-uma-url" } }),
      response,
    );

    expect(authService.resolveTrustedOrigin).toHaveBeenCalledWith(undefined);
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

  it("googleCallback redireciona quando os parametros sao invalidos", async () => {
    const response = mockResponse();

    await AuthController.googleCallback(mockRequest({ query: { code: 1, state: "a" } }), response);

    expect(response.redirect).toHaveBeenCalledWith(
      "http://localhost:3001/login?error=Parametros%20OAuth%20invalidos.",
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

  it("googleCallback usa a origem do state no sucesso quando nao ha redirect de app", async () => {
    const response = mockResponse();

    authService.authenticateWithGoogle.mockResolvedValueOnce({ token: "jwt", user: buildPublicUser() });
    authService.peekGoogleStateOrigin.mockReturnValueOnce("https://192.168.101.13");

    await AuthController.googleCallback(mockRequest({ query: { code: "c", state: "s" } }), response);

    expect(response.redirect).toHaveBeenCalledWith(
      "https://192.168.101.13/login?token=jwt&tipo=cliente&success=1",
    );
  });

  it("googleCallback usa a origem do state no erro do provider", async () => {
    const response = mockResponse();

    authService.peekGoogleStateOrigin.mockReturnValueOnce("https://192.168.101.13");

    await AuthController.googleCallback(
      mockRequest({ query: { error: "access_denied", state: "s" } }),
      response,
    );

    expect(response.redirect).toHaveBeenCalledWith(
      "https://192.168.101.13/login?error=Google%20OAuth%20retornou%20erro%3A%20access_denied",
    );
  });

  it("googleCallback usa a origem do state quando o service falha", async () => {
    const response = mockResponse();

    authService.authenticateWithGoogle.mockRejectedValueOnce(new Error("invalid"));
    authService.peekGoogleStateOrigin.mockReturnValueOnce("https://192.168.101.13");

    await AuthController.googleCallback(mockRequest({ query: { code: "c", state: "s" } }), response);

    expect(response.redirect).toHaveBeenCalledWith("https://192.168.101.13/login?error=invalid");
  });
});
