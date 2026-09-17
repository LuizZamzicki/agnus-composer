import { checarPermissao } from "../../src/middlewares/permission.middleware";
import { PERMISSIONS } from "../../src/config/permissions";
import { mockRequest, mockResponse } from "../helpers/http";

describe("permission.middleware", () => {
  it("retorna 401 sem autenticacao", () => {
    const next = jest.fn(), middleware = checarPermissao(PERMISSIONS.PRODUTO_CRIAR), response = mockResponse();
    middleware(mockRequest(), response, next);
    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({ message: "Nao autenticado." });
    expect(next).not.toHaveBeenCalled();
  });

  it("retorna 403 quando o cargo nao possui a permissao", () => {
    const next = jest.fn(), middleware = checarPermissao(PERMISSIONS.PRODUTO_CRIAR), response = mockResponse();
    response.locals.authUser = { id_usuario: 1, email: "a@a.com", tipo: "cliente" };
    middleware(mockRequest(), response, next);
    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({
      message: 'Acesso negado: permissao "produtos:criar" e necessaria.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("chama next quando o cargo possui a permissao", () => {
    const next = jest.fn(), middleware = checarPermissao(PERMISSIONS.PRODUTO_CRIAR), response = mockResponse();
    response.locals.authUser = { id_usuario: 1, email: "a@a.com", tipo: "administrador" };
    middleware(mockRequest(), response, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
