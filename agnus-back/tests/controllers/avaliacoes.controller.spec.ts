import AvaliacaoFotosController from "../../src/controllers/avaliacaoFotos.controller";
import AvaliacaoProdutosController from "../../src/controllers/avaliacaoProdutos.controller";
import AvaliacaoFotos from "../../src/models/AvaliacaoFotos";
import AvaliacaoProdutos from "../../src/models/AvaliacaoProdutos";
import PedidoItens from "../../src/models/PedidoItens";
import Pedidos from "../../src/models/Pedidos";
import ProdutoCores from "../../src/models/ProdutoCores";
import Produtos from "../../src/models/Produtos";
import Usuarios from "../../src/models/Usuarios";
import { buildModelInstance, mockRequest, mockResponse } from "../helpers/http";
import { JPEG_BYTES, PNG_BYTES } from "../helpers/images";
import * as fotoStorage from "../../src/utils/avaliacaoFotoStorage";
import { INVALID_IMAGE_MESSAGE } from "../../src/utils/imageSignature";

jest.mock("../../src/models/AvaliacaoFotos", () => ({
  __esModule: true,
  default: { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn(), count: jest.fn() },
}));
jest.mock("../../src/models/AvaliacaoProdutos", () => ({
  __esModule: true,
  default: { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn(), findOne: jest.fn() },
}));
jest.mock("../../src/models/PedidoItens", () => ({ __esModule: true, default: { count: jest.fn() } }));
jest.mock("../../src/models/Pedidos", () => ({ __esModule: true, default: { findAll: jest.fn() } }));
jest.mock("../../src/models/ProdutoCores", () => ({ __esModule: true, default: { findAll: jest.fn() } }));
jest.mock("../../src/models/Produtos", () => ({
  __esModule: true,
  default: { findByPk: jest.fn() },
}));
jest.mock("../../src/models/Usuarios", () => ({
  __esModule: true,
  default: { findByPk: jest.fn() },
}));

type AvaliacaoFotosModelMock = { findAll: jest.Mock; findByPk: jest.Mock; create: jest.Mock; count: jest.Mock };
type AvaliacaoProdutosModelMock = { findAll: jest.Mock; findByPk: jest.Mock; create: jest.Mock; findOne: jest.Mock };
type ProdutosModelMock = { findByPk: jest.Mock };
type UsuariosModelMock = { findByPk: jest.Mock };

const avaliacaoFotosModel = AvaliacaoFotos as typeof AvaliacaoFotos & AvaliacaoFotosModelMock;
const avaliacaoProdutosModel = AvaliacaoProdutos as typeof AvaliacaoProdutos & AvaliacaoProdutosModelMock;
const produtosModel = Produtos as typeof Produtos & ProdutosModelMock;
const usuariosModel = Usuarios as typeof Usuarios & UsuariosModelMock;
const pedidosModel = Pedidos as unknown as { findAll: jest.Mock };
const coresModel = ProdutoCores as unknown as { findAll: jest.Mock };
const pedidoItensModel = PedidoItens as unknown as { count: jest.Mock };
const mockCompraEntregue = (itens = 1) => {
  pedidosModel.findAll.mockResolvedValueOnce([{ id_pedido: 9 }]);
  coresModel.findAll.mockResolvedValueOnce([{ id_produto_cor: 3 }]);
  pedidoItensModel.count.mockResolvedValueOnce(itens);
};

describe("AvaliacaoProdutosController", () => {
  it("getByIdProduto retorna 400 para id inválido", async () => {
    const res = mockResponse();
    await AvaliacaoProdutosController.getByIdProduto(mockRequest({ params: { id_produto: "x" } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "ID do produto inválido." });
  });

  it("getByIdProduto retorna 404 quando não encontra avaliações", async () => {
    const res = mockResponse();
    avaliacaoProdutosModel.findAll.mockResolvedValueOnce(null);
    await AvaliacaoProdutosController.getByIdProduto(mockRequest({ params: { id_produto: "1" } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Avaliação de produto não encontrada." });
  });

  it("getByIdProduto retorna 200 com lista vazia", async () => {
    const res = mockResponse();
    avaliacaoProdutosModel.findAll.mockResolvedValueOnce([]);
    await AvaliacaoProdutosController.getByIdProduto(mockRequest({ params: { id_produto: "1" } }), res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith([]);
  });

  it("create retorna 400 quando faltam campos obrigatórios", async () => {
    const res = mockResponse();
    await AvaliacaoProdutosController.create(mockRequest({ body: {} }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "id_produto e id_usuario são obrigatórios." });
  });

  it("create retorna 400 para id_produto inválido", async () => {
    const res = mockResponse();
    await AvaliacaoProdutosController.create(mockRequest({ body: { id_produto: "x", id_usuario: 1 } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "id_produto inválido." });
  });

  it("create retorna 400 para nota inválida", async () => {
    const res = mockResponse();
    await AvaliacaoProdutosController.create(mockRequest({ body: { id_produto: 1, id_usuario: 1, nota: 11 } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "nota inválida. Use valor entre 1 e 5." });
  });

  it("create retorna 404 quando o produto não existe", async () => {
    const res = mockResponse();
    produtosModel.findByPk.mockResolvedValueOnce(null);
    await AvaliacaoProdutosController.create(mockRequest({ body: { id_produto: 1, id_usuario: 1 } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Produto não encontrado." });
  });

  it("create retorna 404 quando o usuário não existe", async () => {
    const res = mockResponse();
    produtosModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_produto: 1 }));
    usuariosModel.findByPk.mockResolvedValueOnce(null);
    await AvaliacaoProdutosController.create(mockRequest({ body: { id_produto: 1, id_usuario: 1 } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Usuário não encontrado." });
  });

  it("create retorna 201 com a avaliação criada", async () => {
    const res = mockResponse();
    const avaliacao = buildModelInstance({ id_avaliacao_produto: 1, id_produto: 1, id_usuario: 1, nota: 4 });
    produtosModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_produto: 1 }));
    usuariosModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_usuario: 1 }));
    mockCompraEntregue();
    avaliacaoProdutosModel.findOne.mockResolvedValueOnce(null);
    avaliacaoProdutosModel.create.mockResolvedValueOnce(avaliacao);
    await AvaliacaoProdutosController.create(
      mockRequest({ body: { id_produto: 1, id_usuario: 1, nota: 4, nome: "Ana", comentario: "Boa compra" } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(avaliacaoProdutosModel.create).toHaveBeenCalledWith({
      id_produto: 1,
      id_usuario: 1,
      titulo: "Ana",
      comentario: "Boa compra",
      nota: 4,
    });
    expect(res.send).toHaveBeenCalledWith(avaliacao);
  });

  it("update retorna 400 para id inválido", async () => {
    const res = mockResponse();
    await AvaliacaoProdutosController.update(mockRequest({ params: { id: "x" }, body: {} }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "ID da avaliação inválido." });
  });

  it("update retorna 404 quando a avaliação não existe", async () => {
    const res = mockResponse();
    avaliacaoProdutosModel.findByPk.mockResolvedValueOnce(null);
    await AvaliacaoProdutosController.update(mockRequest({ params: { id: "1" }, body: {} }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Avaliação de produto não encontrada." });
  });

  it("update retorna 404 quando o produto informado não existe", async () => {
    const res = mockResponse();
    const avaliacao = buildModelInstance({ id_avaliacao_produto: 1, id_produto: 1, id_usuario: 1, nota: 4, titulo: null, comentario: null });
    avaliacaoProdutosModel.findByPk.mockResolvedValueOnce(avaliacao);
    produtosModel.findByPk.mockResolvedValueOnce(null);
    await AvaliacaoProdutosController.update(mockRequest({ params: { id: "1" }, body: { id_produto: 2 } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Produto não encontrado." });
  });

  it("update retorna 404 quando o usuário informado não existe", async () => {
    const res = mockResponse();
    const avaliacao = buildModelInstance({ id_avaliacao_produto: 1, id_produto: 1, id_usuario: 1, nota: 4, titulo: null, comentario: null });
    avaliacaoProdutosModel.findByPk.mockResolvedValueOnce(avaliacao);
    usuariosModel.findByPk.mockResolvedValueOnce(null);
    await AvaliacaoProdutosController.update(mockRequest({ params: { id: "1" }, body: { id_usuario: 2 } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Usuário não encontrado." });
  });

  it("update retorna 400 para nota inválida", async () => {
    const res = mockResponse();
    const avaliacao = buildModelInstance({ id_avaliacao_produto: 1, id_produto: 1, id_usuario: 1, nota: 4, titulo: null, comentario: null });
    avaliacaoProdutosModel.findByPk.mockResolvedValueOnce(avaliacao);
    await AvaliacaoProdutosController.update(mockRequest({ params: { id: "1" }, body: { nota: -1 } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "nota inválida. Use valor entre 1 e 5." });
  });

  it("update retorna 400 para id_produto inválido", async () => {
    const res = mockResponse();
    const avaliacao = buildModelInstance({ id_avaliacao_produto: 1, id_produto: 1, id_usuario: 1, nota: 4, titulo: null, comentario: null });
    avaliacaoProdutosModel.findByPk.mockResolvedValueOnce(avaliacao);
    await AvaliacaoProdutosController.update(mockRequest({ params: { id: "1" }, body: { id_produto: "x" } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "id_produto inválido." });
  });

  it("update retorna 200 com a avaliação atualizada", async () => {
    const res = mockResponse();
    const avaliacao = buildModelInstance({ id_avaliacao_produto: 1, id_produto: 1, id_usuario: 1, nota: 4, titulo: null, comentario: null });
    avaliacaoProdutosModel.findByPk.mockResolvedValueOnce(avaliacao);
    produtosModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_produto: 1 }));
    usuariosModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_usuario: 1 }));
    await AvaliacaoProdutosController.update(
      mockRequest({ params: { id: "1" }, body: { id_produto: 1, id_usuario: 1, nota: 5, nome: "Bia", comentario: "Atualizada" } }),
      res,
    );
    expect(avaliacao.update).toHaveBeenCalledWith({
      id_produto: 1,
      id_usuario: 1,
      titulo: "Bia",
      comentario: "Atualizada",
      nota: 5,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(avaliacao);
  });

  it("remove retorna 400 para id inválido", async () => {
    const res = mockResponse();
    await AvaliacaoProdutosController.remove(mockRequest({ params: { id: "x" } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "ID da avaliação inválido." });
  });

  it("remove retorna 404 quando a avaliação não existe", async () => {
    const res = mockResponse();
    avaliacaoProdutosModel.findByPk.mockResolvedValueOnce(null);
    await AvaliacaoProdutosController.remove(mockRequest({ params: { id: "1" } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Avaliação de produto não encontrada." });
  });

  it("remove retorna 204 quando exclui a avaliação", async () => {
    const res = mockResponse();
    const avaliacao = buildModelInstance({ id_avaliacao_produto: 1 });
    avaliacaoProdutosModel.findByPk.mockResolvedValueOnce(avaliacao);
    await AvaliacaoProdutosController.remove(mockRequest({ params: { id: "1" } }), res);
    expect(avaliacao.destroy).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(204);
  });

  describe("regras de elegibilidade", () => {
    const body = { id_produto: 1, id_usuario: 1, nota: 5 };
    const mockReferencias = () => {
      produtosModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_produto: 1 }));
      usuariosModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_usuario: 1 }));
    };

    it("create retorna 403 para quem não tem pedido entregue", async () => {
      const res = mockResponse();
      mockReferencias();
      pedidosModel.findAll.mockResolvedValueOnce([]);
      coresModel.findAll.mockResolvedValueOnce([{ id_produto_cor: 3 }]);
      await AvaliacaoProdutosController.create(mockRequest({ body }), res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(avaliacaoProdutosModel.create).not.toHaveBeenCalled();
    });

    it("create retorna 403 quando os pedidos entregues não contem o produto", async () => {
      const res = mockResponse();
      mockReferencias();
      mockCompraEntregue(0);
      await AvaliacaoProdutosController.create(mockRequest({ body }), res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("create retorna 409 na segunda avaliação do mesmo produto", async () => {
      const res = mockResponse();
      mockReferencias();
      mockCompraEntregue();
      avaliacaoProdutosModel.findOne.mockResolvedValueOnce(buildModelInstance({ id_avaliacao_produto: 7 }));
      await AvaliacaoProdutosController.create(mockRequest({ body }), res);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(avaliacaoProdutosModel.create).not.toHaveBeenCalled();
    });

    it.each([0, 5.5, 10])("create recusa nota %s fora da escala", async (nota) => {
      const res = mockResponse();
      await AvaliacaoProdutosController.create(mockRequest({ body: { ...body, nota } }), res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("update não move a avaliação para outro produto", async () => {
      const res = mockResponse();
      const avaliacao = buildModelInstance({ id_avaliacao_produto: 1, id_produto: 1, id_usuario: 1, nota: 4, titulo: null, comentario: null });
      avaliacaoProdutosModel.findByPk.mockResolvedValueOnce(avaliacao);
      produtosModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_produto: 2 }));
      await AvaliacaoProdutosController.update(mockRequest({ params: { id: "1" }, body: { id_produto: 2 } }), res);
      expect(avaliacao.update).toHaveBeenCalledWith(expect.objectContaining({ id_produto: 1, id_usuario: 1 }));
    });
  });
});

describe("AvaliacaoFotosController", () => {
  it("getByIdReview retorna 400 para id inválido", async () => {
    const res = mockResponse();
    await AvaliacaoFotosController.getByIdReview(mockRequest({ params: { id_review: "x" } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "ID da avaliação inválido." });
  });

  it("getByIdReview retorna 404 quando não encontra fotos", async () => {
    const res = mockResponse();
    avaliacaoFotosModel.findAll.mockResolvedValueOnce(null);
    await AvaliacaoFotosController.getByIdReview(mockRequest({ params: { id_review: "1" } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Foto da avaliação não encontrada." });
  });

  it("getByIdReview retorna 200 com lista vazia", async () => {
    const res = mockResponse();
    avaliacaoFotosModel.findAll.mockResolvedValueOnce([]);
    await AvaliacaoFotosController.getByIdReview(mockRequest({ params: { id_review: "1" } }), res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith([]);
  });

  it("create retorna 400 quando id_avaliacao_produto e inválido", async () => {
    const res = mockResponse();
    await AvaliacaoFotosController.create(mockRequest({ body: {} }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "id_avaliacao_produto inválido." });
  });

  it("create retorna 400 para id_avaliacao_produto inválido no body", async () => {
    const res = mockResponse();
    await AvaliacaoFotosController.create(mockRequest({ body: { id_avaliacao_produto: "x", fotos_upload: [] } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "id_avaliacao_produto inválido." });
  });

  it("create retorna 400 quando fotos_upload esta vazio", async () => {
    const res = mockResponse();
    await AvaliacaoFotosController.create(mockRequest({ body: { id_avaliacao_produto: 1, fotos_upload: [] } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "fotos_upload (ou arquivos enviados) deve conter pelo menos uma foto." });
  });

  it("create retorna 404 quando a avaliação de produto não existe", async () => {
    const res = mockResponse();
    avaliacaoProdutosModel.findByPk.mockResolvedValueOnce(null);
    await AvaliacaoFotosController.create(
      mockRequest({
        body: { id_avaliacao_produto: 1, fotos_upload: [{ upload_index: 0, nome_original: "a.jpg", tipo_arquivo: "image/jpeg", tamanho_bytes: 10, arquivo_base64: Buffer.from("abc").toString("base64") }] },
      }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Avaliação de produto não encontrada." });
  });

  it("create retorna 201 ao salvar varias fotos", async () => {
    const res = mockResponse();
    const foto = buildModelInstance({ id_avaliacao_foto: 1, id_avaliacao_produto: 1, caminho_url: "avaliacao_fotos/a.jpg" });
    avaliacaoProdutosModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_avaliacao_produto: 1 }));
    avaliacaoFotosModel.create
      .mockResolvedValueOnce(foto)
      .mockResolvedValueOnce(buildModelInstance({ id_avaliacao_foto: 2, id_avaliacao_produto: 1, caminho_url: "avaliacao_fotos/b.jpg" }));
    await AvaliacaoFotosController.create(
      mockRequest({
        body: {
          id_avaliacao_produto: 1,
          fotos_upload: [
            { upload_index: 0, nome_original: "a.jpg", tipo_arquivo: "image/jpeg", tamanho_bytes: 10, arquivo_base64: JPEG_BYTES.toString("base64") },
            { upload_index: 1, nome_original: "b.png", tipo_arquivo: "image/png", tamanho_bytes: 10, arquivo_base64: PNG_BYTES.toString("base64") },
          ],
        },
      }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(avaliacaoFotosModel.create).toHaveBeenCalledTimes(2);
  });

  it("create retorna 201 usando arquivos enviados via multer (req.files)", async () => {
    const res = mockResponse();
    const foto = buildModelInstance({ id_avaliacao_foto: 1, id_avaliacao_produto: 1, caminho_url: "avaliacao_fotos/a.png" });
    avaliacaoProdutosModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_avaliacao_produto: 1 }));
    avaliacaoFotosModel.create.mockResolvedValueOnce(foto);
    const file = { buffer: PNG_BYTES, mimetype: "image/png", originalname: "a.png", size: 10 } as Express.Multer.File;
    await AvaliacaoFotosController.create(
      { ...mockRequest({ body: { id_avaliacao_produto: 1 } }), files: [file] } as unknown as Parameters<typeof AvaliacaoFotosController.create>[0],
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(avaliacaoFotosModel.create).toHaveBeenCalledTimes(1);
  });

  it("create retorna 400 quando o arquivo do multer não é uma imagem válida", async () => {
    const res = mockResponse();
    avaliacaoProdutosModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_avaliacao_produto: 1 }));
    const file = { buffer: Buffer.from("fake-bytes"), mimetype: "application/pdf", originalname: "a.pdf", size: 10 } as Express.Multer.File;
    await AvaliacaoFotosController.create(
      { ...mockRequest({ body: { id_avaliacao_produto: 1 } }), files: [file] } as unknown as Parameters<typeof AvaliacaoFotosController.create>[0],
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: INVALID_IMAGE_MESSAGE });
  });

  it("update retorna 400 para id inválido", async () => {
    const res = mockResponse();
    await AvaliacaoFotosController.update(mockRequest({ params: { id: "x" }, body: {} }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "ID da foto inválido." });
  });

  it("update retorna 404 quando a foto não existe", async () => {
    const res = mockResponse();
    avaliacaoFotosModel.findByPk.mockResolvedValueOnce(null);
    await AvaliacaoFotosController.update(mockRequest({ params: { id: "1" }, body: {} }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Foto da avaliação não encontrada." });
  });

  it("update retorna 400 para id_avaliacao_produto inválido", async () => {
    const res = mockResponse();
    const foto = buildModelInstance({ id_avaliacao_foto: 1, id_avaliacao_produto: 1, caminho_url: "a.jpg" });
    avaliacaoFotosModel.findByPk.mockResolvedValueOnce(foto);
    await AvaliacaoFotosController.update(mockRequest({ params: { id: "1" }, body: { id_avaliacao_produto: "x" } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "id_avaliacao_produto inválido." });
  });

  it("update retorna 404 quando a avaliação informada não existe", async () => {
    const res = mockResponse();
    const foto = buildModelInstance({ id_avaliacao_foto: 1, id_avaliacao_produto: 1, caminho_url: "a.jpg" });
    avaliacaoFotosModel.findByPk.mockResolvedValueOnce(foto);
    avaliacaoProdutosModel.findByPk.mockResolvedValueOnce(null);
    await AvaliacaoFotosController.update(mockRequest({ params: { id: "1" }, body: { id_avaliacao_produto: 2 } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Avaliação de produto não encontrada." });
  });

  it("update retorna 400 quando o upload enviado não e imagem válida", async () => {
    const res = mockResponse();
    const foto = buildModelInstance({ id_avaliacao_foto: 1, id_avaliacao_produto: 1, caminho_url: "a.jpg" });
    avaliacaoFotosModel.findByPk.mockResolvedValueOnce(foto);
    await AvaliacaoFotosController.update(
      mockRequest({ params: { id: "1" }, body: { foto_upload: { upload_index: 0, nome_original: "a.jpg", tipo_arquivo: "image/jpeg", tamanho_bytes: 10, arquivo_base64: "" } } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: INVALID_IMAGE_MESSAGE });
  });

  it("update retorna 400 para caminho_url vazio", async () => {
    const res = mockResponse();
    avaliacaoFotosModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_avaliacao_foto: 1, id_avaliacao_produto: 1, caminho_url: "a.jpg" }));
    await AvaliacaoFotosController.update(mockRequest({ params: { id: "1" }, body: { caminho_url: " " } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "caminho_url inválido." });
  });

  it("update retorna 200 com a foto atualizada via arquivo enviado por multer", async () => {
    const res = mockResponse();
    const foto = buildModelInstance({ id_avaliacao_foto: 1, id_avaliacao_produto: 1, caminho_url: "a.jpg" });
    avaliacaoFotosModel.findByPk.mockResolvedValueOnce(foto);
    const file = { buffer: PNG_BYTES, mimetype: "image/png", originalname: "b.png", size: 10 } as Express.Multer.File;
    await AvaliacaoFotosController.update(
      { ...mockRequest({ params: { id: "1" }, body: {} }), files: [file] } as unknown as Parameters<typeof AvaliacaoFotosController.update>[0],
      res,
    );
    expect(foto.update).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("update retorna 200 com a foto atualizada", async () => {
    const res = mockResponse();
    const foto = buildModelInstance({ id_avaliacao_foto: 1, id_avaliacao_produto: 1, caminho_url: "a.jpg" });
    avaliacaoFotosModel.findByPk.mockResolvedValueOnce(foto);
    avaliacaoProdutosModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_avaliacao_produto: 1 }));
    await AvaliacaoFotosController.update(mockRequest({ params: { id: "1" }, body: { id_avaliacao_produto: 1, caminho_url: "b.jpg" } }), res);
    expect(foto.update).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(foto);
  });

  it("remove retorna 400 para id inválido", async () => {
    const res = mockResponse();
    await AvaliacaoFotosController.remove(mockRequest({ params: { id: "x" } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "ID da foto inválido." });
  });

  it("remove retorna 404 quando a foto não existe", async () => {
    const res = mockResponse();
    avaliacaoFotosModel.findByPk.mockResolvedValueOnce(null);
    await AvaliacaoFotosController.remove(mockRequest({ params: { id: "1" } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Foto da avaliação não encontrada." });
  });

  it("remove retorna 204 quando exclui a foto", async () => {
    const res = mockResponse();
    const foto = buildModelInstance({ id_avaliacao_foto: 1 });
    avaliacaoFotosModel.findByPk.mockResolvedValueOnce(foto);
    await AvaliacaoFotosController.remove(mockRequest({ params: { id: "1" } }), res);
    expect(foto.destroy).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(204);
  });

  describe("ciclo de vida dos arquivos", () => {
    const file = { buffer: PNG_BYTES, mimetype: "image/png", originalname: "b.png", size: 10 } as Express.Multer.File;
    const updateReq = (id: string, body = {}) =>
      ({ ...mockRequest({ params: { id }, body }), files: [file] }) as unknown as Parameters<typeof AvaliacaoFotosController.update>[0];
    let save: jest.SpyInstance;
    let remove: jest.SpyInstance;

    beforeEach(() => {
      save = jest.spyOn(fotoStorage, "saveAvaliacaoFotoFile").mockResolvedValue("avaliacao_fotos/novo.png");
      remove = jest.spyOn(fotoStorage, "deleteAvaliacaoFotoFile").mockResolvedValue(undefined);
      avaliacaoFotosModel.count.mockResolvedValue(0);
    });

    afterEach(() => {
      save.mockRestore();
      remove.mockRestore();
      avaliacaoFotosModel.count.mockReset();
    });

    it("update não grava arquivo quando a foto não existe", async () => {
      const res = mockResponse();
      avaliacaoFotosModel.findByPk.mockResolvedValueOnce(null);
      await AvaliacaoFotosController.update(updateReq("999"), res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(save).not.toHaveBeenCalled();
    });

    it("update não grava arquivo quando a avaliação informada e inválida", async () => {
      const res = mockResponse();
      avaliacaoFotosModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_avaliacao_foto: 1, caminho_url: "avaliacao_fotos/a.png" }));
      await AvaliacaoFotosController.update(updateReq("1", { id_avaliacao_produto: "abc" }), res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(save).not.toHaveBeenCalled();
    });

    it("update apaga o arquivo anterior ao trocar a foto", async () => {
      const res = mockResponse();
      avaliacaoFotosModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_avaliacao_foto: 1, id_avaliacao_produto: 1, caminho_url: "avaliacao_fotos/a.png" }));
      await AvaliacaoFotosController.update(updateReq("1"), res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(remove).toHaveBeenCalledWith("avaliacao_fotos/a.png");
    });

    it("remove apaga o arquivo da foto excluida", async () => {
      const foto = buildModelInstance({ id_avaliacao_foto: 1, caminho_url: "avaliacao_fotos/a.png" });
      avaliacaoFotosModel.findByPk.mockResolvedValueOnce(foto);
      await AvaliacaoFotosController.remove(mockRequest({ params: { id: "1" } }), mockResponse());
      expect(remove).toHaveBeenCalledWith("avaliacao_fotos/a.png");
    });

    it("remove preserva o arquivo que outra foto ainda usa", async () => {
      const foto = buildModelInstance({ id_avaliacao_foto: 1, caminho_url: "avaliacao_fotos/a.png" });
      avaliacaoFotosModel.findByPk.mockResolvedValueOnce(foto);
      avaliacaoFotosModel.count.mockResolvedValueOnce(1);
      await AvaliacaoFotosController.remove(mockRequest({ params: { id: "1" } }), mockResponse());
      expect(remove).not.toHaveBeenCalled();
    });

    it("create apaga o que já gravou quando outra foto do lote e inválida", async () => {
      const res = mockResponse();
      save.mockResolvedValueOnce("avaliacao_fotos/ok.png").mockResolvedValueOnce(null);
      avaliacaoProdutosModel.findByPk.mockResolvedValueOnce(buildModelInstance({ id_avaliacao_produto: 1 }));
      await AvaliacaoFotosController.create(
        { ...mockRequest({ body: { id_avaliacao_produto: 1 } }), files: [file, file] } as unknown as Parameters<typeof AvaliacaoFotosController.create>[0],
        res,
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(remove).toHaveBeenCalledWith("avaliacao_fotos/ok.png");
    });
  });
});
