import authenticateToken, {
  identifyOptionalUser,
  authorizeRoles,
  authorizeSelfOrAdmin,
  limparCacheDeUsuarios,
} from "../../src/middlewares/auth.middleware";
import { consultarOuNull } from "../../src/utils/clienteInterno";
import { verificarToken } from "../../src/utils/token";
import { mockRequest, mockResponse } from "../helpers/http";

jest.mock("../../src/utils/clienteInterno", () => ({ __esModule: true, consultarOuNull: jest.fn() }));
jest.mock("../../src/utils/token", () => ({ __esModule: true, verificarToken: jest.fn() }));

const usuariosModel = { findByPk: consultarOuNull as jest.Mock };
const authService = { verifyToken: verificarToken as jest.Mock };

describe("auth.middleware", () => {
  beforeEach(() => limparCacheDeUsuarios());

  it("authenticateToken retorna 401 sem token", async () => {
    const next = jest.fn(), response = mockResponse();
    await authenticateToken(mockRequest(), response, next);
    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({ message: "Token não informado." });
  });

  it("authenticateToken retorna 401 para token inválido", async () => {
    const next = jest.fn(), response = mockResponse();
    authService.verifyToken.mockReturnValueOnce(null);
    await authenticateToken(mockRequest({ headers: { authorization: "Bearer token" } }), response, next);
    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({ message: "Token inválido ou expirado." });
  });

  it("authenticateToken retorna 401 quando o usuário do token não existe", async () => {
    const next = jest.fn(), response = mockResponse();
    authService.verifyToken.mockReturnValueOnce({ id_usuario: 1, email: "a@a.com", tipo: "cliente" });
    usuariosModel.findByPk.mockResolvedValueOnce(null);
    await authenticateToken(mockRequest({ headers: { authorization: "Bearer token" } }), response, next);
    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({ message: "Usuário do token não existe mais." });
  });

  it("authenticateToken retorna 401 quando o token esta desatualizado", async () => {
    const next = jest.fn(), response = mockResponse();
    authService.verifyToken.mockReturnValueOnce({ id_usuario: 1, email: "old@a.com", tipo: "cliente" });
    usuariosModel.findByPk.mockResolvedValueOnce({ id_usuario: 1, email: "new@a.com", tipo: "cliente" });
    await authenticateToken(mockRequest({ headers: { authorization: "Bearer token" } }), response, next);
    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({ message: "Token desatualizado. Faça login novamente." });
  });

  it("authenticateToken define authUser e chama next no sucesso", async () => {
    const next = jest.fn(), response = mockResponse();
    authService.verifyToken.mockReturnValueOnce({ id_usuario: 1, email: "a@a.com", tipo: "administrador" });
    usuariosModel.findByPk.mockResolvedValueOnce({ id_usuario: 1, email: "a@a.com", tipo: "administrador" });
    await authenticateToken(mockRequest({ headers: { authorization: "Bearer token" } }), response, next);
    expect(response.locals.authUser).toEqual({ id_usuario: 1, email: "a@a.com", tipo: "administrador" });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("authorizeRoles retorna 401 sem autenticação", () => {
    const next = jest.fn(), middleware = authorizeRoles("administrador"), response = mockResponse();
    middleware(mockRequest(), response, next);
    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({ message: "Não autenticado." });
  });

  it("authorizeRoles retorna 403 sem permissão", () => {
    const next = jest.fn(), middleware = authorizeRoles("administrador"), response = mockResponse();
    response.locals.authUser = { id_usuario: 1, email: "a@a.com", tipo: "cliente" };
    middleware(mockRequest(), response, next);
    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({ message: "Sem permissão para este recurso." });
  });

  it("authorizeRoles chama next quando o papel e permitido", () => {
    const next = jest.fn(), middleware = authorizeRoles("administrador"), response = mockResponse();
    response.locals.authUser = { id_usuario: 1, email: "a@a.com", tipo: "administrador" };
    middleware(mockRequest(), response, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("authorizeSelfOrAdmin retorna 401 sem autenticação", () => {
    const next = jest.fn(), middleware = authorizeSelfOrAdmin("id"), response = mockResponse();
    middleware(mockRequest(), response, next);
    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({ message: "Não autenticado." });
  });

  it("authorizeSelfOrAdmin libera administrador", () => {
    const next = jest.fn(), middleware = authorizeSelfOrAdmin("id"), response = mockResponse();
    response.locals.authUser = { id_usuario: 1, email: "a@a.com", tipo: "administrador" };
    middleware(mockRequest({ params: { id: "9" } }), response, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("authorizeSelfOrAdmin retorna 400 para id inválido", () => {
    const next = jest.fn(), middleware = authorizeSelfOrAdmin("id"), response = mockResponse();
    response.locals.authUser = { id_usuario: 2, email: "b@b.com", tipo: "cliente" };
    middleware(mockRequest({ params: { id: "x" } }), response, next);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "ID de usuário inválido." });
  });

  it("authorizeSelfOrAdmin retorna 403 para outro usuário", () => {
    const next = jest.fn(), middleware = authorizeSelfOrAdmin("id"), response = mockResponse();
    response.locals.authUser = { id_usuario: 2, email: "b@b.com", tipo: "cliente" };
    middleware(mockRequest({ params: { id: "3" } }), response, next);
    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({ message: "Você só pode acessar o próprio usuário." });
  });

  it("authorizeSelfOrAdmin chama next para o próprio usuário", () => {
    const next = jest.fn(), middleware = authorizeSelfOrAdmin("id"), response = mockResponse();
    response.locals.authUser = { id_usuario: 2, email: "b@b.com", tipo: "cliente" };
    middleware(mockRequest({ params: { id: "2" } }), response, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  describe("identifyOptionalUser", () => {
    const req = mockRequest({ headers: { authorization: "Bearer token" } });
    const payload = { id_usuario: 1, email: "a@a.com", tipo: "administrador" as const };

    it("segue sem usuário quando não ha token", async () => {
      const next = jest.fn(), response = mockResponse();
      await identifyOptionalUser(mockRequest(), response, next);
      expect(response.locals.authUser).toBeUndefined();
      expect(next).toHaveBeenCalledTimes(1);
    });

    it("segue como anonimo quando o token e inválido", async () => {
      const next = jest.fn(), response = mockResponse();
      authService.verifyToken.mockReturnValueOnce(null);
      await identifyOptionalUser(req, response, next);
      expect(response.locals.authUser).toBeUndefined();
      expect(next).toHaveBeenCalledTimes(1);
    });

    it("ignora token cujo cargo mudou no banco", async () => {
      const next = jest.fn(), response = mockResponse();
      authService.verifyToken.mockReturnValueOnce(payload);
      usuariosModel.findByPk.mockResolvedValueOnce({ ...payload, tipo: "cliente" });
      await identifyOptionalUser(req, response, next);
      expect(response.locals.authUser).toBeUndefined();
    });

    it("identifica o usuário de um token válido", async () => {
      const next = jest.fn(), response = mockResponse();
      authService.verifyToken.mockReturnValueOnce(payload);
      usuariosModel.findByPk.mockResolvedValueOnce(payload);
      await identifyOptionalUser(req, response, next);
      expect(response.locals.authUser).toEqual(payload);
    });
  });
});
