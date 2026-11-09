import NotificacoesController from "../../src/controllers/notificacoes.controller";
import Notificacoes from "../../src/models/Notificacoes";
import { mockRequest, mockResponse } from "../helpers/http";

jest.mock("../../src/models/Notificacoes", () => ({
  __esModule: true,
  default: { findAll: jest.fn(), count: jest.fn(), update: jest.fn() },
}));

const model = Notificacoes as unknown as { findAll: jest.Mock; count: jest.Mock; update: jest.Mock };
const autenticado = () => {
  const response = mockResponse();
  response.locals.authUser = { id_usuario: 3, email: "a@a.com", tipo: "cliente" };
  return response;
};

describe("NotificacoesController", () => {
  it("findMine lista só as notificacoes do usuário do token", async () => {
    const response = autenticado();
    model.findAll.mockResolvedValueOnce([{ id_notificacao: 1 }]);
    model.count.mockResolvedValueOnce(1);
    await NotificacoesController.findMine(mockRequest({ query: { id_usuario: "9" } }), response);
    expect(model.findAll).toHaveBeenCalledWith(expect.objectContaining({ where: { id_usuario: 3, lida: false } }));
    expect(response.json).toHaveBeenCalledWith({ data: [{ id_notificacao: 1 }], naoLidas: 1 });
  });

  it("markAsRead altera só a notificação do próprio usuário", async () => {
    const response = autenticado();
    model.update.mockResolvedValueOnce([1]);
    await NotificacoesController.markAsRead(mockRequest({ params: { id: "5" } }), response);
    expect(model.update).toHaveBeenCalledWith({ lida: true }, { where: { id_notificacao: 5, id_usuario: 3 } });
    expect(response.status).toHaveBeenCalledWith(204);
  });

  it("markAsRead retorna 404 para notificação de outra pessoa", async () => {
    const response = autenticado();
    model.update.mockResolvedValueOnce([0]);
    model.count.mockResolvedValueOnce(0);
    await NotificacoesController.markAsRead(mockRequest({ params: { id: "5" } }), response);
    expect(response.status).toHaveBeenCalledWith(404);
  });

  it("markAsRead retorna 400 para id inválido", async () => {
    const response = autenticado();
    await NotificacoesController.markAsRead(mockRequest({ params: { id: "x" } }), response);
    expect(response.status).toHaveBeenCalledWith(400);
  });

  it("markAllAsRead só atinge o usuário do token", async () => {
    const response = autenticado();
    model.update.mockResolvedValueOnce([2]);
    await NotificacoesController.markAllAsRead(mockRequest(), response);
    expect(model.update).toHaveBeenCalledWith({ lida: true }, { where: { id_usuario: 3, lida: false } });
    expect(response.status).toHaveBeenCalledWith(204);
  });
});
