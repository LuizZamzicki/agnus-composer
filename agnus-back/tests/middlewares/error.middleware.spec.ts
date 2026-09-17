import { MulterError } from "multer";
import { errorHandler } from "../../src/middlewares/error.middleware";
import { HttpError } from "../../src/types/http_error";
import { mockRequest, mockResponse } from "../helpers/http";

describe("error.middleware", () => {
  it("responde com o status e a mensagem de um HttpError", () => {
    const next = jest.fn(), response = mockResponse();
    errorHandler(new HttpError(404, "Recurso nao encontrado."), mockRequest(), response, next);
    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ message: "Recurso nao encontrado." });
  });

  it("traduz LIMIT_FILE_SIZE do multer para uma mensagem amigavel", () => {
    const next = jest.fn(), response = mockResponse();
    errorHandler(new MulterError("LIMIT_FILE_SIZE"), mockRequest(), response, next);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      message: "Arquivo muito grande. Tamanho maximo permitido: 20MB.",
    });
  });

  it("traduz outros erros do multer com a mensagem original", () => {
    const next = jest.fn(), response = mockResponse();
    errorHandler(new MulterError("LIMIT_FIELD_KEY"), mockRequest(), response, next);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      message: expect.stringContaining("Erro no upload:"),
    });
  });

  it("responde 409 para violacao de unicidade do Sequelize", () => {
    const next = jest.fn(), response = mockResponse();
    const error = new Error("duplicado");
    error.name = "SequelizeUniqueConstraintError";
    errorHandler(error, mockRequest(), response, next);
    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith({ message: "Este registro ja existe no sistema." });
  });

  it("responde 400 para violacao de chave estrangeira do Sequelize", () => {
    const next = jest.fn(), response = mockResponse();
    const error = new Error("fk");
    error.name = "SequelizeForeignKeyConstraintError";
    errorHandler(error, mockRequest(), response, next);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      message: "Operacao invalida: referencia um dado que nao existe ou esta em uso.",
    });
  });

  it("responde 400 para erro de validacao do Sequelize", () => {
    const next = jest.fn(), response = mockResponse();
    const error = new Error("invalido");
    error.name = "SequelizeValidationError";
    errorHandler(error, mockRequest(), response, next);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "Os dados enviados sao invalidos." });
  });

  it("responde 500 para erros desconhecidos", () => {
    const next = jest.fn(), response = mockResponse();
    errorHandler(new Error("boom"), mockRequest(), response, next);
    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      message: "Erro interno do servidor. Tente novamente mais tarde.",
    });
  });
});
