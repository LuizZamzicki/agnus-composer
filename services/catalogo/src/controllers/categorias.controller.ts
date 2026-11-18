import { Request, Response } from "express";
import { CACHE_NAMESPACES, CACHE_TTL } from "../config/cache";
import sequelize from "@agnus/comum/config/database";
import Categorias from "../models/Categorias";
import Produtos from "../models/Produtos";
import CacheService from "../services/cache.service";
import EventBusService from "@agnus/comum/services/eventBus.service";
import type {
  CategoriaBody,
  CategoriaQuery,
  CategoriaRouteParams,
} from "../types/categoria.types";
import type { AgnusEventType } from "@agnus/comum/types/event.types";
import { buildPaginationMeta, parsePagination } from "@agnus/comum/utils/pagination";

type CategoriaRequest = Request<CategoriaRouteParams, object, CategoriaBody, CategoriaQuery>;

class CategoriaPayload {
  constructor(private readonly body: CategoriaBody) {}

  get nome() {
    return CategoriasController.normalizeName(this.body.nome);
  }

  hasNameField() {
    return this.body.nome !== undefined;
  }
}

class CategoriasController {
  static parsePositiveId(value: string | undefined) {
    const parsedId = Number(value);

    return Number.isInteger(parsedId) && parsedId > 0 ? parsedId : null;
  }

  static normalizeName(value: string | null | undefined) {
    const normalizedValue = value?.trim();

    return normalizedValue ? normalizedValue : null;
  }

  private static getCreateErrorMessage(payload: CategoriaPayload) {
    return !payload.hasNameField() || !payload.nome
      ? "nome e obrigatório."
      : null;
  }

  private static getUpdateErrorMessage(payload: CategoriaPayload) {
    return payload.hasNameField() && !payload.nome
      ? "nome inválido."
      : null;
  }

  // O banco compara sem diferenciar maiúsculas e acentos: "camisetas" e "Camisetas" são o mesmo nome.
  // Na edição, encontrar a própria categoria não é duplicidade (ex.: só corrigir maiúsculas).
  private static async findDuplicateMessage(nome: string | null, idAtual?: number) {
    if (!nome) {
      return null;
    }

    const existente = await Categorias.findOne({ where: { nome } });

    return existente && existente.id_categoria !== idAtual ? "Já existe categoria com esse nome." : null;
  }

  // O catalogo de produtos exibe o nome da categoria, entao os dois namespaces sao invalidados.
  private static async afterChange(type: AgnusEventType, categoria: Categorias) {
    const reason = `${type}:${categoria.id_categoria}`;

    await CacheService.invalidateNamespace(CACHE_NAMESPACES.categorias, reason);
    await CacheService.invalidateNamespace(CACHE_NAMESPACES.produtos, reason);
    await EventBusService.publish(type, { id_categoria: categoria.id_categoria, nome: categoria.nome });
  }

  static async findAll(req: CategoriaRequest, res: Response) {
    const pagination = parsePagination(req.query);

    if (!pagination) {
      return res.status(400).json({ message: "page e limit devem ser inteiros positivos." });
    }

    const result = await CacheService.getOrSet(
      CacheService.buildKey(CACHE_NAMESPACES.categorias, "lista", { page: pagination.page, limit: pagination.limit }),
      CACHE_TTL.categoriasLista,
      async () => {
        const { count, rows } = await Categorias.findAndCountAll({
          limit: pagination.limit,
          offset: pagination.offset,
          order: [["id_categoria", "ASC"]],
        });

        return {
          data: rows,
          pagination: buildPaginationMeta(pagination.page, pagination.limit, count),
        };
      },
    );

    return res.status(200).json(result);
  }

  static async getById(req: CategoriaRequest, res: Response) {
    const categoryId = CategoriasController.parsePositiveId(req.params.id);

    if (!categoryId) {
      return res.status(400).json({ message: "ID da categoria inválido." });
    }

    const categoria = await CacheService.getOrSet(
      CacheService.buildKey(CACHE_NAMESPACES.categorias, "detalhe", { id: categoryId }),
      CACHE_TTL.categoriaDetalhe,
      () => Categorias.findByPk(categoryId),
      (value) => value !== null,
    );

    if (!categoria) {
      return res.status(404).json({ message: "Categoria não encontrada." });
    }

    return res.status(200).send(categoria);
  }

  static async create(req: CategoriaRequest, res: Response) {
    const payload = new CategoriaPayload(req.body);
    const message = CategoriasController.getCreateErrorMessage(payload);
    const duplicateMessage = message
      ? null
      : await CategoriasController.findDuplicateMessage(payload.nome);

    if (message) {
      return res.status(400).json({ message });
    }

    if (duplicateMessage) {
      return res.status(400).json({ message: duplicateMessage });
    }

    const categoria = await Categorias.create({ nome: payload.nome! });

    await CategoriasController.afterChange("categoria.criada", categoria);
    return res.status(201).send(categoria);
  }

  static async update(req: CategoriaRequest, res: Response) {
    const categoryId = CategoriasController.parsePositiveId(req.params.id);
    const payload = new CategoriaPayload(req.body);

    if (!categoryId) {
      return res.status(400).json({ message: "ID da categoria inválido." });
    }

    const categoria = await Categorias.findByPk(categoryId);
    const message = CategoriasController.getUpdateErrorMessage(payload);
    const duplicateMessage = !message && categoria
      ? await CategoriasController.findDuplicateMessage(payload.nome, categoria.id_categoria)
      : null;

    if (!categoria) {
      return res.status(404).json({ message: "Categoria não encontrada." });
    }

    if (message) {
      return res.status(400).json({ message });
    }

    if (duplicateMessage) {
      return res.status(400).json({ message: duplicateMessage });
    }

    await categoria.update({ nome: payload.nome ?? categoria.nome });
    await CategoriasController.afterChange("categoria.atualizada", categoria);
    return res.status(200).send(categoria);
  }

  static async remove(req: CategoriaRequest, res: Response) {
    const categoryId = CategoriasController.parsePositiveId(req.params.id);

    if (!categoryId) {
      return res.status(400).json({ message: "ID da categoria inválido." });
    }

    const categoria = await Categorias.findByPk(categoryId);

    if (!categoria) {
      return res.status(404).json({ message: "Categoria não encontrada." });
    }

    // Produto aponta para a categoria (chave estrangeira): excluir direto daria erro no banco.
    // Sem confirmação, responde quantos produtos seriam afetados; com ?mover_produtos=true, eles
    // ficam "Sem categoria" e a categoria sai, tudo na mesma transação.
    const produtos = await Produtos.count({ where: { id_categoria: categoryId } });
    const confirmado = String((req.query as Record<string, unknown>).mover_produtos ?? "") === "true";

    if (produtos > 0 && !confirmado) {
      return res.status(409).json({
        message: `A categoria "${categoria.nome}" tem ${produtos} produto(s). Confirme para excluir e deixá-los sem categoria.`,
        produtos,
      });
    }

    await sequelize.transaction(async (transaction) => {
      if (produtos > 0) {
        await Produtos.update({ id_categoria: null }, { where: { id_categoria: categoryId }, transaction });
      }

      await categoria.destroy({ transaction });
    });
    await CategoriasController.afterChange("categoria.removida", categoria);
    return res.status(204).send();
  }
}

export default CategoriasController;
