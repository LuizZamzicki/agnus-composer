import { createHmac } from "crypto";
import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";
import type { AuthUserPayload } from "../types/auth.types";

/**
 * Tokens de sessão.
 *
 * Com JWT_PRIVATE_KEY / JWT_PUBLIC_KEY (ES256): só a identidade tem a chave privada e assina;
 * os demais serviços recebem só a pública, que confere mas não cria token. Um serviço invadido
 * não consegue forjar um login de administrador.
 *
 * Sem as chaves (desenvolvimento e testes), vale o modo antigo: HS256 com JWT_SECRET.
 * O algoritmo aceito é fixado pelo modo, nunca lido do próprio token.
 */

// Aceita o PEM direto (com \n literais) ou em base64 numa linha só, que cabe no .env.
const lerChave = (nome: string) => {
  const valor = process.env[nome]?.trim();

  if (!valor) {
    return null;
  }

  return valor.includes("-----BEGIN")
    ? valor.replace(/\\n/g, "\n")
    : Buffer.from(valor, "base64").toString("utf8");
};

const segredoJwt = () => {
  const segredo = process.env.JWT_SECRET;

  if (!segredo) {
    throw new Error("JWT_SECRET não configurado.");
  }

  return segredo;
};

export const ALGORITMO_ASSIMETRICO = "ES256";

export const usaChavesAssimetricas = () => Boolean(lerChave("JWT_PUBLIC_KEY"));

/** Só a identidade chama: assina com a chave privada quando configurada. */
export const assinarToken = (payload: AuthUserPayload, expiresIn: SignOptions["expiresIn"]) => {
  const privada = lerChave("JWT_PRIVATE_KEY");

  return privada
    ? jwt.sign(payload, privada, { algorithm: ALGORITMO_ASSIMETRICO, expiresIn })
    : jwt.sign(payload, segredoJwt(), { expiresIn });
};

/**
 * Marca da credencial atual: muda sempre que o hash da senha muda (troca de senha ou vínculo
 * com o Google). O token carrega a marca de quando foi emitido; se não bate mais, a sessão caiu.
 * É um HMAC do hash, então não revela nada sobre a senha. Só a identidade calcula.
 */
export const marcaDeSessao = (senhaHash: string | null | undefined) =>
  createHmac("sha256", process.env.JWT_SECRET || lerChave("JWT_PRIVATE_KEY") || segredoJwt())
    .update(String(senhaHash ?? ""))
    .digest("base64url")
    .slice(0, 16);

export const verificarToken = (token: string): AuthUserPayload | null => {
  const publica = lerChave("JWT_PUBLIC_KEY");
  const chave = publica ?? segredoJwt();
  const algorithms: jwt.Algorithm[] = publica ? [ALGORITMO_ASSIMETRICO] : ["HS256"];

  try {
    const decoded = jwt.verify(token, chave, { algorithms }) as JwtPayload & AuthUserPayload;

    return decoded.id_usuario && decoded.email && decoded.tipo
      ? {
          id_usuario: decoded.id_usuario,
          email: decoded.email,
          tipo: decoded.tipo,
          ...(typeof decoded.sessao === "string" ? { sessao: decoded.sessao } : {}),
        }
      : null;
  } catch {
    return null;
  }
};
