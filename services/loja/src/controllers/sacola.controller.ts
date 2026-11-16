import { Request, Response } from "express";
import type { AuthenticatedResponseLocals } from "@agnus/comum/middlewares/auth.middleware";
import { HttpError } from "@agnus/comum/types/http_error";
import { listarPedidos } from "../services/pedidos.service";
import {
  adicionarLinhas,
  atualizarLinha,
  buscarSacola,
  criarSacola,
  enderecoDoCheckout,
  removerLinha,
  sacolaDoComprador,
  vincularSacola,
  type Comprador,
} from "../services/sacola.service";

type Resposta = Response<object, AuthenticatedResponseLocals>;

// Sacola é dado do cliente: nem o navegador nem um proxy podem guardar a resposta.
const semCache = (res: Resposta) => res.set("Cache-Control", "no-store");

// Toda conta compra como cliente (o painel administrativo saiu; a loja é gerida no Shopify).
// As rotas que usam isto já passam por authenticateToken.
const compradorObrigatorio = (res: Resposta): Comprador => {
  const usuario = res.locals.authUser;

  if (!usuario) {
    throw new HttpError(401, "Entre na sua conta para continuar.");
  }

  return { id_usuario: usuario.id_usuario, email: usuario.email };
};

class SacolaController {
  static async criar(req: Request, res: Resposta) {
    return semCache(res).status(201).json(await criarSacola(req.body?.linhas, compradorObrigatorio(res), req.ip));
  }

  static async buscar(req: Request, res: Resposta) {
    return semCache(res).status(200).json(await buscarSacola(String(req.params.id), req.ip));
  }

  static async minha(req: Request, res: Resposta) {
    return semCache(res).status(200).json(await sacolaDoComprador(compradorObrigatorio(res), req.ip));
  }

  static async adicionar(req: Request, res: Resposta) {
    return semCache(res).status(200).json(await adicionarLinhas(String(req.params.id), req.body?.linhas, req.ip));
  }

  static async atualizar(req: Request, res: Resposta) {
    const sacola = await atualizarLinha(String(req.params.id), String(req.params.linha), req.body?.quantidade, req.ip);
    return semCache(res).status(200).json(sacola);
  }

  static async remover(req: Request, res: Resposta) {
    return semCache(res).status(200).json(await removerLinha(String(req.params.id), String(req.params.linha), req.ip));
  }

  static async vincular(req: Request, res: Resposta) {
    return semCache(res).status(200).json(await vincularSacola(String(req.params.id), compradorObrigatorio(res), req.ip));
  }

  static async pedidos(_req: Request, res: Resposta) {
    return semCache(res).status(200).json(await listarPedidos(compradorObrigatorio(res)));
  }

  static async checkout(req: Request, res: Resposta) {
    return semCache(res).status(200).json(await enderecoDoCheckout(String(req.params.id), compradorObrigatorio(res), req.ip));
  }
}

export default SacolaController;
