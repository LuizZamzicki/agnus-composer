import type { NextFunction, Request, Response } from "express";
import authenticateToken, { type AuthenticatedResponseLocals } from "@agnus/comum/middlewares/auth.middleware";
import { getRedisClient } from "@agnus/comum/config/redis";
import logger from "@agnus/comum/utils/logger";
import { Afiliados } from "../models";
import AfiliadoService from "../services/afiliado.service";
import { config } from "../utils/config";
import { assinaturaConfere, calcularAssinatura, decifrar, lerCabecalhoAssinatura } from "../utils/seguranca";

export type LocaisAfiliado = AuthenticatedResponseLocals & { afiliado?: Afiliados };
export type RespostaAfiliado = Response<object, LocaisAfiliado>;

const TOLERANCIA_RELOGIO_S = 600;

const negar = (res: Response, status: number, message: string) => res.status(status).json({ message });

// Limite por hora e por AppID, no Redis (sem Redis, não limita: melhor que derrubar a API).
const dentroDoLimite = async (appId: string) => {
  const redis = getRedisClient();
  if (!redis || redis.status !== "ready") return true;

  const chave = `agnus:afiliados:limite:${appId}:${Math.floor(Date.now() / 3600000)}`;
  const usadas = await redis.incr(chave);
  if (usadas === 1) await redis.expire(chave, 3600);
  return usadas <= config.limitePorHora();
};

// Payload assinado: corpo bruto (POST) ou a query string sem "?" (GET), como explicado no openapi.yaml.
const payloadDaRequisicao = (req: Request) => {
  if (req.method === "GET" || req.method === "DELETE") {
    const indice = req.originalUrl.indexOf("?");
    return indice === -1 ? "" : req.originalUrl.slice(indice + 1);
  }
  return (req as Request & { rawBody?: Buffer }).rawBody?.toString("utf8") ?? "";
};

const porAssinatura = async (req: Request, res: RespostaAfiliado, next: NextFunction) => {
  const credencial = lerCabecalhoAssinatura(req.header("authorization"));
  if (!credencial) return negar(res, 401, "Cabeçalho Authorization inválido. Use: SHA256 Credential=<AppId>, Timestamp=<unix>, Signature=<hex>.");

  const timestamp = Number(credencial.timestamp);
  if (!Number.isInteger(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > TOLERANCIA_RELOGIO_S) {
    return negar(res, 401, "Timestamp fora da janela de 10 minutos. Confira o relógio do servidor.");
  }

  const afiliado = await Afiliados.findOne({ where: { app_id: credencial.appId } });
  if (!afiliado?.segredo_cifrado) return negar(res, 401, "Credencial inválida.");

  let segredo: string;
  try {
    segredo = decifrar(afiliado.segredo_cifrado);
  } catch {
    logger.error("afiliados.segredo_ilegivel", { afiliado: afiliado.id_afiliado });
    return negar(res, 401, "Credencial inválida. Gere uma nova no painel.");
  }

  const esperada = calcularAssinatura(credencial.appId, credencial.timestamp, payloadDaRequisicao(req), segredo);
  if (!assinaturaConfere(credencial.assinatura, esperada)) return negar(res, 401, "Assinatura inválida.");

  if (!(await dentroDoLimite(credencial.appId))) {
    return negar(res, 429, "Limite de requisições por hora atingido. Tente de novo mais tarde.");
  }

  res.locals.afiliado = afiliado;
  return next();
};

// Só a sessão do site (Bearer): para ações que a integração não pode fazer, como trocar a credencial.
export const afiliadoDaSessao = (req: Request, res: RespostaAfiliado, next: NextFunction) =>
  authenticateToken(req, res, async (erro?: unknown) => {
    if (erro) return next(erro);

    const afiliado = await AfiliadoService.porUsuario(res.locals.authUser!.id_usuario);
    if (!afiliado) return negar(res, 404, "Você ainda não faz parte do programa de afiliados.");

    res.locals.afiliado = afiliado;
    return next();
  });

// Afiliado logado no site (Bearer) OU integração dele (assinatura SHA256 com AppID e segredo).
export const autenticarAfiliado = (req: Request, res: RespostaAfiliado, next: NextFunction) =>
  req.header("authorization")?.startsWith("SHA256 ") ? porAssinatura(req, res, next) : afiliadoDaSessao(req, res, next);

export const exigirAfiliadoAtivo = (_req: Request, res: RespostaAfiliado, next: NextFunction) => {
  const status = res.locals.afiliado?.status;

  if (status === "ativo") return next();
  if (status === "pendente") return negar(res, 403, "Seu cadastro de afiliado está em análise.");
  return negar(res, 403, "Seu cadastro de afiliado não está ativo.");
};
