import { Request, Response } from "express";
import { CACHE_NAMESPACES, CACHE_TTL } from "../config/cache";
import Categorias from "../models/Categorias";
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

  private static async findDuplicateMessage(nome: string | null, currentName?: string) {
    return !nome || nome === currentName || !(await Categorias.findOne({ where: { nome } }))
      ? null
      : "Já existe categoria com esse nome.";
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
      ? await CategoriasController.findDuplicateMessage(payload.nome, categoria.nome)
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

    await categoria.destroy();
    await CategoriasController.afterChange("categoria.removida", categoria);
    return res.status(204).send();
  }
}

export default CategoriasController;
