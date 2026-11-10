import { Request, Response } from "express";
import AvaliacaoProdutos from "../models/AvaliacaoProdutos";
import PedidoItens from "../models/PedidoItens";
import Pedidos from "../models/Pedidos";
import ProdutoCores from "../models/ProdutoCores";
import Produtos from "../models/Produtos";
import Usuarios from "../models/Usuarios";
import type {
  AvaliacaoProdutoBody,
  AvaliacaoProdutoCreateData,
  AvaliacaoProdutoNotaValue,
  AvaliacaoProdutoRouteParams,
  AvaliacaoProdutoUpdateData,
} from "../types/avaliacao-produto.types";

type AvaliacaoProdutoRequest = Request<AvaliacaoProdutoRouteParams, object, AvaliacaoProdutoBody>;

class AvaliacaoProdutoPayload {
  constructor(private readonly body: AvaliacaoProdutoBody) {}

  get productId() {
    return AvaliacaoProdutosController.parsePositiveId(this.body.id_produto);
  }

  get userId() {
    return AvaliacaoProdutosController.parsePositiveId(this.body.id_usuario);
  }

  get nota() {
    return AvaliacaoProdutosController.parseNota(this.body.nota);
  }

  get titulo() {
    return AvaliacaoProdutosController.normalizeText(this.body.titulo ?? this.body.nome);
  }

  get comentario() {
    return AvaliacaoProdutosController.normalizeText(this.body.comentario);
  }

  hasProductField() {
    return this.body.id_produto !== undefined;
  }

  hasUserField() {
    return this.body.id_usuario !== undefined;
  }

  hasNotaField() {
    return this.body.nota !== undefined;
  }

  hasTituloField() {
    return this.body.titulo !== undefined || this.body.nome !== undefined;
  }

  hasComentarioField() {
    return this.body.comentario !== undefined;
  }
}

class AvaliacaoProdutosController {
  static parsePositiveId(value: number | string | null | undefined) {
    const parsedId = Number(value);
    return Number.isInteger(parsedId) && parsedId > 0 ? parsedId : null;
  }

  static parseNota(value: AvaliacaoProdutoBody["nota"]): AvaliacaoProdutoNotaValue {
    if (value === undefined) {
      return undefined;
    }

    if (value === null || value === "") {
      return null;
    }

    const parsedNota = Number(value);

    return Number.isNaN(parsedNota) ? "invalid" : parsedNota;
  }

  static normalizeText(value: string | null | undefined) {
    const normalizedValue = value?.trim();
    return normalizedValue ? normalizedValue : null;
  }

  private static hasValidNota(nota: AvaliacaoProdutoNotaValue) {
    return (
      nota !== "invalid" &&
      (nota === undefined || nota === null || (nota >= 0.5 && nota <= 5 && Number.isInteger(nota * 2)))
    );
  }

  private static getCreateErrorMessage(payload: AvaliacaoProdutoPayload) {
    if (!payload.hasProductField() || !payload.hasUserField()) {
      return "id_produto e id_usuario são obrigatórios.";
    }

    if (!payload.productId) {
      return "id_produto inválido.";
    }

    if (!payload.userId) {
      return "id_usuario inválido.";
    }

    if (!AvaliacaoProdutosController.hasValidNota(payload.nota)) {
      return "nota inválida. Use de 0,5 a 5, de meia em meia estrela.";
    }

    return null;
  }

  private static getUpdateErrorMessage(payload: AvaliacaoProdutoPayload) {
    if (payload.hasProductField() && !payload.productId) {
      return "id_produto inválido.";
    }

    if (payload.hasUserField() && !payload.userId) {
      return "id_usuario inválido.";
    }

    if (
      payload.hasNotaField() &&
      !AvaliacaoProdutosController.hasValidNota(payload.nota)
    ) {
      return "nota inválida. Use de 0,5 a 5, de meia em meia estrela.";
    }

    return null;
  }

  private static async findMissingReferenceMessage(productId?: number | null, userId?: number | null) {
    if (productId && !(await Produtos.findByPk(productId))) {
      return "Produto não encontrado.";
    }

    if (userId && !(await Usuarios.findByPk(userId))) {
      return "Usuário não encontrado.";
    }

    return null;
  }

  // Regra do dominio: so quem recebeu o produto avalia. O front esconde o formulario, mas quem decide e a API.
  private static async hasDeliveredPurchase(userId: number, productId: number) {
    const pedidos = await Pedidos.findAll({
      where: { id_usuario: userId, status: "entregue" },
      attributes: ["id_pedido"],
    });
    const cores = await ProdutoCores.findAll({
      where: { id_produto: productId },
      attributes: ["id_produto_cor"],
    });

    if (!pedidos.length || !cores.length) {
      return false;
    }

    const itens = await PedidoItens.count({
      where: {
        id_pedido: pedidos.map((pedido) => pedido.id_pedido),
        id_produto_cor: cores.map((cor) => cor.id_produto_cor),
      },
    });

    return itens > 0;
  }

  private static normalizeNotaValue(nota: AvaliacaoProdutoNotaValue) {
    return typeof nota === "number" ? nota : null;
  }

  private static buildCreateData(payload: AvaliacaoProdutoPayload): AvaliacaoProdutoCreateData {
    return {
      id_produto: payload.productId!,
      id_usuario: payload.userId!,
      titulo: payload.titulo,
      comentario: payload.comentario,
      nota: AvaliacaoProdutosController.normalizeNotaValue(payload.nota),
    };
  }

  private static buildUpdateData(
    avaliacao: AvaliacaoProdutos,
    payload: AvaliacaoProdutoPayload,
  ): AvaliacaoProdutoUpdateData {
    return {
      id_produto: avaliacao.id_produto,
      id_usuario: avaliacao.id_usuario,
      titulo: payload.hasTituloField() ? payload.titulo : avaliacao.titulo,
      comentario: payload.hasComentarioField() ? payload.comentario : avaliacao.comentario,
      nota: payload.hasNotaField()
        ? AvaliacaoProdutosController.normalizeNotaValue(payload.nota)
        : avaliacao.nota,
    };
  }

  static async getByIdProduto(req: AvaliacaoProdutoRequest, res: Response) {
    const productId = AvaliacaoProdutosController.parsePositiveId(req.params.id_produto);

    if (!productId) {
      return res.status(400).json({ message: "ID do produto inválido." });
    }

    const avaliacoes = await AvaliacaoProdutos.findAll({ where: { id_produto: productId } });

    if (!avaliacoes) {
      return res.status(404).json({ message: "Avaliação de produto não encontrada." });
    }

    return res.status(200).send(avaliacoes);
  }

  static async create(req: AvaliacaoProdutoRequest, res: Response) {
    const payload = new AvaliacaoProdutoPayload(req.body);
    const message = AvaliacaoProdutosController.getCreateErrorMessage(payload);

    if (message) {
      return res.status(400).json({ message });
    }

    const referenceMessage = await AvaliacaoProdutosController.findMissingReferenceMessage(
      payload.productId,
      payload.userId,
    );

    if (referenceMessage) {
      return res.status(404).json({ message: referenceMessage });
    }

    if (!(await AvaliacaoProdutosController.hasDeliveredPurchase(payload.userId!, payload.productId!))) {
      return res.status(403).json({ message: "Somente quem recebeu o produto pode avaliá-lo." });
    }

    if (await AvaliacaoProdutos.findOne({ where: { id_produto: payload.productId!, id_usuario: payload.userId! } })) {
      return res.status(409).json({ message: "Você já avaliou este produto." });
    }

    return res
      .status(201)
      .send(
        await AvaliacaoProdutos.create(
          AvaliacaoProdutosController.buildCreateData(payload),
        ),
      );
  }

  static async update(req: AvaliacaoProdutoRequest, res: Response) {
    const reviewId = AvaliacaoProdutosController.parsePositiveId(req.params.id);
    const payload = new AvaliacaoProdutoPayload(req.body);

    if (!reviewId) {
      return res.status(400).json({ message: "ID da avaliação inválido." });
    }

    const avaliacao = await AvaliacaoProdutos.findByPk(reviewId);
    const message = AvaliacaoProdutosController.getUpdateErrorMessage(payload);

    if (!avaliacao) {
      return res.status(404).json({ message: "Avaliação de produto não encontrada." });
    }

    if (message) {
      return res.status(400).json({ message });
    }

    const referenceMessage = await AvaliacaoProdutosController.findMissingReferenceMessage(
      payload.productId,
      payload.userId,
    );

    if (referenceMessage) {
      return res.status(404).json({ message: referenceMessage });
    }

    await avaliacao.update(
      AvaliacaoProdutosController.buildUpdateData(avaliacao, payload),
    );

    return res.status(200).send(avaliacao);
  }

  static async remove(req: AvaliacaoProdutoRequest, res: Response) {
    const reviewId = AvaliacaoProdutosController.parsePositiveId(req.params.id);

    if (!reviewId) {
      return res.status(400).json({ message: "ID da avaliação inválido." });
    }

    const avaliacao = await AvaliacaoProdutos.findByPk(reviewId);

    if (!avaliacao) {
      return res.status(404).json({ message: "Avaliação de produto não encontrada." });
    }

    await avaliacao.destroy();
    return res.status(204).send();
  }
}

export default AvaliacaoProdutosController;
