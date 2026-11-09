import { NextFunction, Request, Response } from "express";
import { consultarOuNull } from "../utils/clienteInterno";
import { verificarToken } from "../utils/token";
import type { AuthUserPayload } from "../types/auth.types";
import type { UserRole } from "../types/user.types";

export type AuthenticatedResponseLocals = {
  authUser?: AuthUserPayload;
};

type AuthResponse = Response<object, AuthenticatedResponseLocals>;

const getBearerToken = (req: Request) => {
  const authHeader = req.headers.authorization;
  return authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
};

type BuscaDeUsuario = (id_usuario: number) => Promise<AuthUserPayload | null>;

const VALIDADE_CACHE_MS = 5000;
const cacheDeUsuarios = new Map<number, { valor: AuthUserPayload | null; expiraEm: number }>();

let busca: BuscaDeUsuario = (id_usuario) =>
  consultarOuNull<AuthUserPayload>("identidade", `/usuarios/${id_usuario}`);

// O serviço de identidade consulta o próprio banco; os demais perguntam a ele pela rede.
export const definirBuscaDeUsuario = (novaBusca: BuscaDeUsuario) => {
  busca = novaBusca;
};

export const limparCacheDeUsuarios = () => cacheDeUsuarios.clear();

// Cache curto: evita uma chamada de rede por requisição e limita a 5 s o atraso de uma revogação.
export const buscarUsuario: BuscaDeUsuario = async (id_usuario) => {
  const emCache = cacheDeUsuarios.get(id_usuario);

  if (emCache && emCache.expiraEm > Date.now()) {
    return emCache.valor;
  }

  const valor = await busca(id_usuario);

  cacheDeUsuarios.set(id_usuario, { valor, expiraEm: Date.now() + VALIDADE_CACHE_MS });
  return valor;
};

const isCurrentToken = (tokenPayload: AuthUserPayload, authUser: AuthUserPayload) => {
  return authUser.email === tokenPayload.email && authUser.tipo === tokenPayload.tipo;
};

const authenticateToken = async (req: Request, res: AuthResponse, next: NextFunction) => {
  const token = getBearerToken(req);
  const tokenPayload = token ? verificarToken(token) : null;

  if (!token) {
    return res.status(401).json({ message: "Token não informado." });
  }

  if (!tokenPayload) {
    return res.status(401).json({ message: "Token inválido ou expirado." });
  }

  const authUser = await buscarUsuario(tokenPayload.id_usuario);

  if (!authUser) {
    return res.status(401).json({ message: "Usuário do token não existe mais." });
  }

  if (!isCurrentToken(tokenPayload, authUser)) {
    return res.status(401).json({ message: "Token desatualizado. Faça login novamente." });
  }

  res.locals.authUser = authUser;
  return next();
};

// Rotas publicas que mostram mais para a equipe: identifica quem tem token valido, sem exigir um.
export const identifyOptionalUser = async (req: Request, res: AuthResponse, next: NextFunction) => {
  const token = getBearerToken(req);
  const tokenPayload = token ? verificarToken(token) : null;
  // Rota pública: sem o serviço de identidade, a pessoa só deixa de ver o conteúdo da equipe.
  const authUser = tokenPayload ? await buscarUsuario(tokenPayload.id_usuario).catch(() => null) : null;

  if (tokenPayload && authUser && isCurrentToken(tokenPayload, authUser)) {
    res.locals.authUser = authUser;
  }

  return next();
};

export const authorizeRoles = (...allowedRoles: UserRole[]) => (req: Request, res: AuthResponse, next: NextFunction) => {
  const authUser = res.locals.authUser;

  if (!authUser) {
    return res.status(401).json({ message: "Não autenticado." });
  }

  if (!allowedRoles.includes(authUser.tipo)) {
    return res.status(403).json({ message: "Sem permissão para este recurso." });
  }

  return next();
};

export const authorizeSelfOrAdmin = (paramName = "id") => (req: Request, res: AuthResponse, next: NextFunction) => {
  const authUser = res.locals.authUser;

  if (!authUser) {
    return res.status(401).json({ message: "Não autenticado." });
  }

  if (authUser.tipo === "administrador") {
    return next();
  }

  const requestedUserId = Number(req.params[paramName]);

  if (!Number.isInteger(requestedUserId)) {
    return res.status(400).json({ message: "ID de usuário inválido." });
  }

  if (requestedUserId !== authUser.id_usuario) {
    return res.status(403).json({ message: "Você só pode acessar o próprio usuário." });
  }

  return next();
};

export default authenticateToken;
