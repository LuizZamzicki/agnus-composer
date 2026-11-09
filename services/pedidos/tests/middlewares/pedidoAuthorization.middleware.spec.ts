import { authorizeOrderOwnerOrAdmin } from "../../src/middlewares/pedidoAuthorization.middleware";
import Pedidos from "../../src/models/Pedidos";
import { buildModelInstance, mockRequest, mockResponse } from "../helpers/http";

jest.mock("../../src/models/Pedidos", () => ({
  __esModule: true,
  default: { findByPk: jest.fn() },
}));

const pedidosModel = Pedidos as unknown as { findByPk: jest.Mock };

describe("pedidoAuthorization.middleware", () => {
  describe("authorizeOrderOwnerOrAdmin", () => {
    it("retorna 401 sem autenticação", async () => {
      const next = jest.fn(), middleware = authorizeOrderOwnerOrAdmin("id"), response = mockResponse();
      await middleware(mockRequest({ params: { id: "1" } }), response, next);
      expect(response.status).toHaveBeenCalledWith(401);
      expect(response.json).toHaveBeenCalledWith({ message: "Não autenticado." });
      expect(next).not.toHaveBeenCalled();
    });

    it("libera administrador sem consultar o pedido", async () => {
      const next = jest.fn(), middleware = authorizeOrderOwnerOrAdmin("id"), response = mockResponse();
      response.locals.authUser = { id_usuario: 1, email: "a@a.com", tipo: "administrador" };
      await middleware(mockRequest({ params: { id: "9" } }), response, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(pedidosModel.findByPk).not.toHaveBeenCalled();
    });

    it("chama next para id inválido, deixando o controller validar", async () => {
      const next = jest.fn(), middleware = authorizeOrderOwnerOrAdmin("id"), response = mockResponse();
      response.locals.authUser = { id_usuario: 2, email: "b@b.com", tipo: "cliente" };
      await middleware(mockRequest({ params: { id: "x" } }), response, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it("chama next quando o pedido não existe, deixando o controller retornar 404", async () => {
      const next = jest.fn(), middleware = authorizeOrderOwnerOrAdmin("id"), response = mockResponse();
      response.locals.authUser = { id_usuario: 2, email: "b@b.com", tipo: "cliente" };
      pedidosModel.findByPk.mockResolvedValueOnce(null);
      await middleware(mockRequest({ params: { id: "1" } }), response, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it("retorna 403 quando o pedido pertence a outro usuário", async () => {
      const next = jest.fn(), middleware = authorizeOrderOwnerOrAdmin("id"), response = mockResponse();
      response.locals.authUser = { id_usuario: 2, email: "b@b.com", tipo: "cliente" };
      pedidosModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_pedido: 1, id_usuario: 5 }));
      await middleware(mockRequest({ params: { id: "1" } }), response, next);
      expect(response.status).toHaveBeenCalledWith(403);
      expect(response.json).toHaveBeenCalledWith({ message: "Você só pode acessar o próprio pedido." });
      expect(next).not.toHaveBeenCalled();
    });

    it("chama next quando o pedido pertence ao próprio usuário", async () => {
      const next = jest.fn(), middleware = authorizeOrderOwnerOrAdmin("id"), response = mockResponse();
      response.locals.authUser = { id_usuario: 2, email: "b@b.com", tipo: "cliente" };
      pedidosModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_pedido: 1, id_usuario: 2 }));
      await middleware(mockRequest({ params: { id: "1" } }), response, next);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});
