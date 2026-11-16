import { Request, Response } from "express";
import { buscarProduto, listarColecoes, listarProdutos, listarRelacionados, type Ordem } from "../services/vitrine.service";

const texto = (valor: unknown) => (typeof valor === "string" && valor !== "" ? valor : undefined);

// Vitrine pública: as respostas já saem do cache do Redis, o navegador pode guardar por pouco tempo.
const cachePublico = (res: Response) => res.set("Cache-Control", "public, max-age=30");

class VitrineController {
  static async listarProdutos(req: Request, res: Response) {
    const { busca, colecao, ordem, depois, antes, limite } = req.query;

    const pagina = await listarProdutos({
      busca: texto(busca),
      colecao: texto(colecao),
      ordem: texto(ordem) as Ordem | undefined,
      depois: texto(depois),
      antes: texto(antes),
      limite: limite === undefined ? undefined : Number(limite),
    });

    return cachePublico(res).status(200).json(pagina);
  }

  static async buscarProduto(req: Request, res: Response) {
    return cachePublico(res).status(200).json(await buscarProduto(String(req.params.handle)));
  }

  static async listarRelacionados(req: Request, res: Response) {
    return cachePublico(res).status(200).json(await listarRelacionados(String(req.params.handle)));
  }

  static async listarColecoes(_req: Request, res: Response) {
    return cachePublico(res).status(200).json(await listarColecoes());
  }
}

export default VitrineController;
