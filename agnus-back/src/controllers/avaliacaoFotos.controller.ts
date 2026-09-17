import { Request, Response } from "express";
import AvaliacaoFotos from "../models/AvaliacaoFotos";
import AvaliacaoProdutos from "../models/AvaliacaoProdutos";
import type {
  AvaliacaoFotoBody,
  AvaliacaoFotoRouteParams,
  AvaliacaoFotoUpload,
} from "../types/avaliacao-foto.types";
import { normalizeFotoPath, saveAvaliacaoFotoFile, saveAvaliacaoFotoUpload } from "../utils/avaliacaoFotoStorage";

type AvaliacaoFotoRequest = Request<AvaliacaoFotoRouteParams, object, AvaliacaoFotoBody>;
type AvaliacaoFotoFiles = Express.Multer.File[] | Record<string, Express.Multer.File[]>;
type AvaliacaoFotoRequestWithFiles = AvaliacaoFotoRequest & { files?: AvaliacaoFotoFiles };

class AvaliacaoFotosController {
  private static parsePositiveId(value: number | string | undefined) {
    const parsedId = Number(value);
    return Number.isInteger(parsedId) && parsedId > 0 ? parsedId : null;
  }

  private static getUploadedFiles(req: AvaliacaoFotoRequestWithFiles) {
    if (!req.files) {
      return [];
    }

    return Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
  }

  private static getCreateUploads(body: AvaliacaoFotoBody) {
    return Array.isArray(body.fotos_upload) ? body.fotos_upload : [];
  }

  private static getCreateErrorMessage(reviewId: number | null, uploads: AvaliacaoFotoUpload[], filesCount: number) {
    if (!reviewId) {
      return "id_avaliacao_produto invalido.";
    }

    if (!uploads.length && !filesCount) {
      return "fotos_upload (ou arquivos enviados) deve conter pelo menos uma foto.";
    }

    return null;
  }

  private static async buildPhotoPaths(files: Express.Multer.File[], uploads: AvaliacaoFotoUpload[]) {
    const photoPaths = await Promise.all(
      files.length ? files.map(saveAvaliacaoFotoFile) : uploads.map(saveAvaliacaoFotoUpload),
    );

    return photoPaths.every((item) => item)
      ? photoPaths as string[]
      : null;
  }

  private static async createPhotos(reviewId: number, photoPaths: string[]) {
    return Promise.all(
      photoPaths.map((caminho_url) =>
        AvaliacaoFotos.create({
          id_avaliacao_produto: reviewId,
          caminho_url,
        }),
      ),
    );
  }

  private static async resolveUpdatePath(body: AvaliacaoFotoBody, file?: Express.Multer.File) {
    if (file) {
      return saveAvaliacaoFotoFile(file);
    }

    if (body.foto_upload) {
      return saveAvaliacaoFotoUpload(body.foto_upload);
    }

    if (body.caminho_url === undefined) {
      return undefined;
    }

    return normalizeFotoPath(body.caminho_url);
  }

  private static getUpdateErrorMessage(
    body: AvaliacaoFotoBody,
    reviewId: number | null,
    photoPath: string | null | undefined,
    hasFile: boolean,
  ) {
    if (body.id_avaliacao_produto !== undefined && !reviewId) {
      return "id_avaliacao_produto invalido.";
    }

    if ((hasFile || body.foto_upload || body.caminho_url !== undefined) && !photoPath) {
      return "caminho_url invalido.";
    }

    return null;
  }

  private static buildUpdateData(
    foto: AvaliacaoFotos,
    reviewId: number | null,
    photoPath: string | undefined,
  ) {
    return {
      id_avaliacao_produto: reviewId ?? foto.id_avaliacao_produto,
      caminho_url: photoPath ?? foto.caminho_url,
    };
  }

  static async getByIdReview(req: AvaliacaoFotoRequest, res: Response) {
    const reviewId = AvaliacaoFotosController.parsePositiveId(req.params.id_review);

    if (!reviewId) {
      return res.status(400).json({ message: "ID da avaliacao invalido." });
    }

    const fotos = await AvaliacaoFotos.findAll({ where: { id_avaliacao_produto: reviewId } });

    if (!fotos) {
      return res.status(404).json({ message: "Foto da avaliacao nao encontrada." });
    }

    return res.status(200).send(fotos);
  }

  static async create(req: AvaliacaoFotoRequestWithFiles, res: Response) {
    const reviewId = AvaliacaoFotosController.parsePositiveId(req.body.id_avaliacao_produto);
    const uploads = AvaliacaoFotosController.getCreateUploads(req.body);
    const files = AvaliacaoFotosController.getUploadedFiles(req);
    const message = AvaliacaoFotosController.getCreateErrorMessage(reviewId, uploads, files.length);

    if (message) {
      return res.status(400).json({ message });
    }

    const avaliacao = await AvaliacaoProdutos.findByPk(reviewId!);

    if (!avaliacao) {
      return res.status(404).json({ message: "Avaliacao de produto nao encontrada." });
    }

    const photoPaths = await AvaliacaoFotosController.buildPhotoPaths(files, uploads);

    if (!photoPaths) {
      return res.status(400).json({ message: "fotos_upload contem arquivo invalido." });
    }

    return res
      .status(201)
      .send(await AvaliacaoFotosController.createPhotos(reviewId!, photoPaths));
  }

  static async update(req: AvaliacaoFotoRequestWithFiles, res: Response) {
    const photoId = AvaliacaoFotosController.parsePositiveId(req.params.id);
    const reviewId = AvaliacaoFotosController.parsePositiveId(req.body.id_avaliacao_produto);
    const uploadedFile = AvaliacaoFotosController.getUploadedFiles(req)[0];

    if (!photoId) {
      return res.status(400).json({ message: "ID da foto invalido." });
    }

    const foto = await AvaliacaoFotos.findByPk(photoId);
    const photoPath = await AvaliacaoFotosController.resolveUpdatePath(req.body, uploadedFile);
    const message = AvaliacaoFotosController.getUpdateErrorMessage(
      req.body,
      reviewId,
      photoPath,
      Boolean(uploadedFile),
    );

    if (!foto) {
      return res.status(404).json({ message: "Foto da avaliacao nao encontrada." });
    }

    if (message) {
      return res.status(400).json({ message });
    }

    if (
      req.body.id_avaliacao_produto !== undefined &&
      !(await AvaliacaoProdutos.findByPk(reviewId!))
    ) {
      return res.status(404).json({ message: "Avaliacao de produto nao encontrada." });
    }

    await foto.update(
      AvaliacaoFotosController.buildUpdateData(
        foto,
        reviewId,
        photoPath ?? undefined,
      ),
    );

    return res.status(200).send(foto);
  }

  static async remove(req: AvaliacaoFotoRequest, res: Response) {
    const photoId = AvaliacaoFotosController.parsePositiveId(req.params.id);

    if (!photoId) {
      return res.status(400).json({ message: "ID da foto invalido." });
    }

    const foto = await AvaliacaoFotos.findByPk(photoId);

    if (!foto) {
      return res.status(404).json({ message: "Foto da avaliacao nao encontrada." });
    }

    await foto.destroy();
    return res.status(204).send();
  }
}

export default AvaliacaoFotosController;
